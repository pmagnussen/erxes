import gql from 'graphql-tag';
import { startPlugin } from 'erxes-api-shared/utils';
import { router } from '~/routes';

startPlugin({
  name: 'veraprovision',
  port: 3320,
  expressRouter: router,
  graphql: async () => ({
    typeDefs: gql`
      extend type Query {
        veraProvisionVersion: String
      }
    `,
    resolvers: { Query: { veraProvisionVersion: () => '1' } },
  }),
  apolloServerContext: async (_subdomain, context) => context,
});
