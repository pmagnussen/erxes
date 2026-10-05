import { Request, Response } from 'express';
import { getSubdomain, sendTRPCMessage } from 'erxes-api-shared/utils';
import { productsSyncSchema, TProductsSyncInput } from '@/provision/schema';

/**
 * POST /provision/products — upsert a product catalog pushed by vera.fo
 * Tenant.Backend (source: e-conomic). Categories are matched by code,
 * products by code (= e-conomic product number). Idempotent; products that
 * are barred upstream are set to status "deleted" and never created.
 * erxes never sees the accounting system's keys.
 */
interface IDoc {
  _id: string;
  code?: string;
  name?: string;
  status?: string;
}

const core = (
  subdomain: string,
  method: 'query' | 'mutation',
  module: string,
  action: string,
  input: unknown,
) =>
  sendTRPCMessage({
    subdomain,
    pluginName: 'core',
    method,
    module,
    action,
    input,
    throwOnError: true,
  });

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const syncCategories = async (subdomain: string, input: TProductsSyncInput) => {
  const ids: Record<string, string> = {};
  const created: string[] = [];
  const updated: string[] = [];

  for (const c of input.categories) {
    const existing = (await core(
      subdomain,
      'query',
      'productCategories',
      'findOne',
      { query: { code: c.code } },
    )) as IDoc | null;

    if (existing?._id) {
      if (existing.name !== c.name) {
        await core(
          subdomain,
          'mutation',
          'productCategories',
          'updateProductCategory',
          { _id: existing._id, doc: { name: c.name, code: c.code } },
        );
        updated.push(c.code);
      }
      ids[c.code] = existing._id;
      continue;
    }

    const doc = (await core(
      subdomain,
      'mutation',
      'productCategories',
      'createProductCategory',
      { doc: { name: c.name, code: c.code } },
    )) as IDoc;
    ids[c.code] = doc._id;
    created.push(c.code);
  }

  return { ids, created, updated };
};

export const syncProducts = async (req: Request, res: Response) => {
  const parsed = productsSyncSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid body', issues: parsed.error.issues });
    return;
  }

  const input = parsed.data;
  const subdomain = getSubdomain(req);

  let categoryIds: Record<string, string>;
  let categories: { created: string[]; updated: string[] };
  try {
    const r = await syncCategories(subdomain, input);
    categoryIds = r.ids;
    categories = { created: r.created, updated: r.updated };
  } catch (e) {
    res.status(500).json({ error: `categories: ${errorText(e)}` });
    return;
  }

  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];
  const errors: { code: string; error: string }[] = [];

  for (const p of input.products) {
    try {
      const existing = (await core(subdomain, 'query', 'products', 'findOne', {
        query: { code: p.code },
      })) as IDoc | null;

      const categoryId = p.categoryCode ? categoryIds[p.categoryCode] : undefined;
      if (p.categoryCode && !categoryId) {
        throw new Error(`Unknown category ${p.categoryCode}`);
      }

      const doc = {
        code: p.code,
        name: p.name,
        description: p.description ?? '',
        unitPrice: p.unitPrice,
        currency: p.currency,
        uom: p.uom,
        type: p.type,
        ...(categoryId ? { categoryId } : {}),
      };

      if (existing?._id) {
        await core(subdomain, 'mutation', 'products', 'updateProduct', {
          _id: existing._id,
          doc: { ...doc, status: p.barred ? 'deleted' : 'active' },
        });
        (p.barred ? deleted : updated).push(p.code);
        continue;
      }

      if (p.barred) {
        continue;
      }

      if (!categoryId) {
        throw new Error('categoryCode is required for new products');
      }

      await core(subdomain, 'mutation', 'products', 'createProduct', { doc });
      created.push(p.code);
    } catch (e) {
      errors.push({ code: p.code, error: errorText(e) });
    }
  }

  res.status(errors.length ? 207 : 200).json({
    ok: !errors.length,
    categories,
    products: { created, updated, deleted },
    errors,
  });
};
