import { useContext } from 'react';
import { StoreContext } from './store-context';

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider missing');
  return store;
}