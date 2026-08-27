import React from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

export default function AppLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <TopHeader title={title} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
