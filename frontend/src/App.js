import React, { useState, useEffect } from 'react';
import { contracts, compliance } from './api';
import './App.css';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeContracts, setActiveContracts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Get compliance overview
        const overviewData = await compliance.getOverview();
        setStats(overviewData.complianceStats);
        
        // Get active contracts
        const contractsData = await contracts.getActive();
        setActiveContracts(contractsData.activeContracts || []);
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load dashboard data. Please check your connection.");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>LegalLens - Contract Management</h1>
          <p>Loading dashboard...</p>
        </header>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>LegalLens - Contract Management</h1>
          <p>{error}</p>
          <p>Please check your API connection at {process.env.REACT_APP_API_URL}</p>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>LegalLens - Contract Management</h1>
        <div className="dashboard">
          {stats && (
            <div className="stats">
              <h2>Compliance Overview</h2>
              <p>Total Contracts: {stats.totalContracts}</p>
              <p>Active Contracts: {stats.activeContracts}</p>
              <p>Expired Contracts: {stats.expiredContracts}</p>
              <p>Compliance Rate: {stats.complianceRate}%</p>
            </div>
          )}
          
          {activeContracts.length > 0 && (
            <div className="contracts">
              <h2>Active Contracts</h2>
              <ul>
                {activeContracts.slice(0, 5).map(contract => (
                  <li key={contract.id}>
                    {contract.title} - {contract.allowedRegions.join(', ')}
                  </li>
                ))}
              </ul>
              {activeContracts.length > 5 && <p>...and {activeContracts.length - 5} more</p>}
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App; 