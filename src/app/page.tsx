import { currentUser, publicUser } from '@/lib/security';
import { App } from '@/components/app';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await currentUser();
  return <App initialUser={user ? publicUser(user) : null} />;
}
