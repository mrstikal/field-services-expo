import { redirect } from 'next/navigation';

export default async function TaskDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const encodedId = encodeURIComponent(id);
  redirect(`/dashboard/tasks?editTaskId=${encodedId}`);
}
