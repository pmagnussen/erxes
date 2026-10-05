import { getEnv } from 'erxes-api-shared/utils';
import { createErxesSession, IErxesUser } from '@/sso/session';
import { TSalesInput } from '@/provision/schema';

/**
 * Sales starter kit: currencies, units, product categories, one board with a
 * ready pipeline (stages + labels). Idempotent — everything is matched by
 * name/code and only missing pieces are created.
 *
 * sales_api / core expose these writes only over GraphQL, so we call the
 * gateway as the workspace owner with a short-lived session (same token
 * format erxes' own login issues).
 */
interface IGqlResult<T> {
  data?: T;
  errors?: { message: string }[];
}

const gatewayUrl = () =>
  (getEnv({ name: 'VERA_GATEWAY_URL' }) || 'http://gateway:4000').replace(
    /\/$/,
    '',
  );

const makeGql =
  (token: string) =>
  async <T>(query: string, variables: Record<string, unknown> = {}) => {
    const r = await fetch(`${gatewayUrl()}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await r.json()) as IGqlResult<T>;
    if (body.errors?.length || !body.data) {
      throw new Error(body.errors?.[0]?.message || `gateway ${r.status}`);
    }
    return body.data;
  };

type TGql = ReturnType<typeof makeGql>;

interface INamed {
  _id: string;
  name: string;
  code?: string;
}

const ensureCurrencies = async (gql: TGql, input: TSalesInput) => {
  await gql(
    `mutation vpConfigsUpdate($m: JSON!) { configsUpdate(configsMap: $m) }`,
    {
      m: { mainCurrency: input.mainCurrency, dealCurrency: input.currencies },
    },
  );
  return { mainCurrency: input.mainCurrency, dealCurrency: input.currencies };
};

const ensureUoms = async (gql: TGql, input: TSalesInput) => {
  const { uoms } = await gql<{ uoms: INamed[] }>(
    `query vpUoms { uoms { _id name code } }`,
  );
  const created: string[] = [];
  for (const u of input.uoms) {
    if (!uoms.some((x) => x.code === u.code)) {
      await gql(
        `mutation vpUomsAdd($name: String, $code: String) { uomsAdd(name: $name, code: $code) { _id } }`,
        u,
      );
      created.push(u.code);
    }
  }
  return { created };
};

const ensureCategories = async (gql: TGql, input: TSalesInput) => {
  const { productCategories } = await gql<{ productCategories: INamed[] }>(
    `query vpCats { productCategories { _id name code } }`,
  );
  const created: string[] = [];
  for (const c of input.productCategories) {
    if (!productCategories.some((x) => x.code === c.code)) {
      await gql(
        `mutation vpCatAdd($name: String!, $code: String!) { productCategoriesAdd(name: $name, code: $code) { _id } }`,
        c,
      );
      created.push(c.name);
    }
  }
  return { created };
};

const ensureBoard = async (gql: TGql, input: TSalesInput) => {
  const { salesBoards } = await gql<{
    salesBoards: (INamed & { pipelines?: INamed[] })[];
  }>(`query vpBoards { salesBoards { _id name pipelines { _id name } } }`);

  let board = salesBoards.find((b) => b.name === input.board);
  if (!board) {
    const d = await gql<{ salesBoardsAdd: INamed }>(
      `mutation vpBoardAdd($name: String!) { salesBoardsAdd(name: $name) { _id name } }`,
      { name: input.board },
    );
    board = { ...d.salesBoardsAdd, pipelines: [] };
  }

  const pipelines: string[] = [];
  for (const p of input.pipelines) {
    let pipeline = board.pipelines?.find((x) => x.name === p.name);
    if (!pipeline) {
      const stages = p.stages.map((s, i) => ({
        _id: `vp-new-${i}`,
        name: s.name,
        probability: s.probability,
        type: 'deal',
        visibility: 'public',
        status: 'active',
      }));
      const d = await gql<{ salesPipelinesAdd: INamed }>(
        `mutation vpPipelineAdd($name: String!, $boardId: String!, $stages: JSON, $visibility: String!) {
          salesPipelinesAdd(name: $name, boardId: $boardId, stages: $stages, visibility: $visibility) { _id name }
        }`,
        { name: p.name, boardId: board._id, stages, visibility: 'public' },
      );
      pipeline = d.salesPipelinesAdd;
      pipelines.push(p.name);
    }

    const { salesPipelineLabels } = await gql<{
      salesPipelineLabels: INamed[];
    }>(
      `query vpLabels($pipelineId: String) { salesPipelineLabels(pipelineId: $pipelineId) { _id name } }`,
      { pipelineId: pipeline._id },
    );
    for (const l of p.labels) {
      if (!salesPipelineLabels.some((x) => x.name === l.name)) {
        await gql(
          `mutation vpLabelAdd($name: String!, $colorCode: String!, $pipelineId: String!) {
            salesPipelineLabelsAdd(name: $name, colorCode: $colorCode, pipelineId: $pipelineId) { _id }
          }`,
          { ...l, pipelineId: pipeline._id },
        );
      }
    }
  }

  return { boardId: board._id, createdPipelines: pipelines };
};

export const provisionSales = async (
  owner: IErxesUser,
  input: TSalesInput,
  run: (step: string, work: () => Promise<unknown>) => Promise<unknown>,
) => {
  const gql = makeGql(await createErxesSession(owner));
  await run('sales-currencies', () => ensureCurrencies(gql, input));
  await run('sales-uoms', () => ensureUoms(gql, input));
  await run('sales-product-categories', () => ensureCategories(gql, input));
  await run('sales-board', () => ensureBoard(gql, input));
};
