import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AICopilot } from './AICopilot';

export function MainLayout() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pt-16 md:pt-6 page-transition">
          <Outlet />
        </main>
      </div>
      <AICopilot />
    </div>
  );
}
