import TaskDetailRedirectPage from '@/app/dashboard/tasks/[id]/page';
import { redirect } from 'next/navigation';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('TaskDetailRedirectPage', () => {
  it('redirects to tasks page with editTaskId', async () => {
    await TaskDetailRedirectPage({
      params: Promise.resolve({ id: 'task-123' }),
    });

    expect(redirect).toHaveBeenCalledWith('/dashboard/tasks?editTaskId=task-123');
  });

  it('encodes special characters in id', async () => {
    await TaskDetailRedirectPage({
      params: Promise.resolve({ id: 'task/abc?x=1' }),
    });

    expect(redirect).toHaveBeenCalledWith(
      '/dashboard/tasks?editTaskId=task%2Fabc%3Fx%3D1'
    );
  });
});
