import type { DataService } from '../../utils/data-service';

/**
 * Databases on the connection that have a collection named `collectionName`,
 * other than `currentDatabase`, sorted. Databases that cannot be read are
 * left out instead of failing the whole list.
 */
export async function listComparableDatabases(
  dataService: DataService,
  collectionName: string,
  currentDatabase: string
): Promise<string[]> {
  const databases = await dataService.listDatabases({ nameOnly: true });
  const matches = await Promise.all(
    databases
      .filter(({ name }) => name !== currentDatabase)
      .map(async ({ name }) => {
        const collections = await dataService
          .listCollections(name, { name: collectionName })
          .catch(() => []);
        return collections.length > 0 ? name : null;
      })
  );
  return matches
    .filter((name): name is string => name !== null)
    .sort((a, b) => a.localeCompare(b));
}
