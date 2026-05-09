import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AICopilot } from './AICopilot';

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
      <AICopilot />
    </div>
  );
}
