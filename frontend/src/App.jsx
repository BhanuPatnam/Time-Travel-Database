import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import CurrentDataPage from './pages/CurrentDataPage';
import TimeTravelPage from './pages/TimeTravelPage';
import TimelinePage from './pages/TimelinePage';
import DiffViewerPage from './pages/DiffViewerPage';
import CheckpointManagerPage from './pages/CheckpointManagerPage';
import BenchmarkCenterPage from './pages/BenchmarkCenterPage';
import RestorationCenterPage from './pages/RestorationCenterPage';
import SettingsPage from './pages/SettingsPage';
import apiService from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbStatus, setDbStatus] = useState(null);
  const [navContext, setNavContext] = useState({ table: 'CUSTOMERS', pk: '101' });

  useEffect(() => {
    apiService.getHealth()
      .then(setDbStatus)
      .catch((err) => {
        setDbStatus({
          status: 'offline',
          database_connected: false,
          database_type: 'Offline / Emulated',
        });
      });
  }, []);

  const handleSelectRecord = (targetTab, table, pk) => {
    setNavContext({ table, pk });
    setActiveTab(targetTab);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar dbStatus={dbStatus} />

      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardPage onNavigate={setActiveTab} onSelectRecord={handleSelectRecord} />
          )}
          {activeTab === 'data' && <CurrentDataPage onSelectRecord={handleSelectRecord} />}
          {activeTab === 'timetravel' && (
            <TimeTravelPage initialTable={navContext.table} initialPk={navContext.pk} />
          )}
          {activeTab === 'timeline' && (
            <TimelinePage initialTable={navContext.table} initialPk={navContext.pk} />
          )}
          {activeTab === 'diff' && <DiffViewerPage />}
          {activeTab === 'checkpoints' && <CheckpointManagerPage />}
          {activeTab === 'benchmarks' && <BenchmarkCenterPage />}
          {activeTab === 'restoration' && <RestorationCenterPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
