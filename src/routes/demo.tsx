import { createFileRoute, redirect } from '@tanstack/react-router';

// The guided workflow is now the homepage; keep /demo as a permanent alias.
export const Route = createFileRoute('/demo')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});
