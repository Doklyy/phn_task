import './Tabs.css';

const TABS = [
  { id: 'tasks', label: 'Nhiệm vụ' },
  { id: 'personnel', label: 'Nhân sự' },
  { id: 'scoring', label: 'Chấm điểm' },
];

export function Tabs({ activeTab, onTabChange }) {
  return (
    <div className="tabs-nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
