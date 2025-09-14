/**
 * Connection Test UI for Browser Plugin
 * Shows comprehensive test results for data-io server connection and authentication
 */

import { dataIOClient } from '../lib/dataIOClient';

interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  details?: any;
  error?: string;
}

interface TestResults {
  success: boolean;
  results: TestResult[];
  summary: {
    totalSteps: number;
    successfulSteps: number;
    totalTime: number;
  };
}

let testOverlay: HTMLDivElement | null = null;

/**
 * Show connection test UI (using content script - has CORS issues)
 */
export function showConnectionTest(projectId?: string) {
  if (testOverlay) {
    testOverlay.remove();
  }
  
  createTestOverlay();
  runConnectionTest(projectId);
}

/**
 * Show connection test UI using background script (avoids CORS issues)
 */
export function showConnectionTestFromBackground(projectId?: string) {
  if (testOverlay) {
    testOverlay.remove();
  }
  
  createTestOverlay();
  runConnectionTestFromBackground(projectId);
}

/**
 * Hide connection test UI
 */
export function hideConnectionTest() {
  if (testOverlay) {
    testOverlay.remove();
    testOverlay = null;
  }
}

function createTestOverlay() {
  testOverlay = document.createElement('div');
  testOverlay.id = 'cogix-connection-test';
  testOverlay.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 600px !important;
    max-width: 90vw !important;
    max-height: 80vh !important;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important;
    border: 1px solid #475569 !important;
    border-radius: 16px !important;
    padding: 24px !important;
    color: white !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 14px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 20px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(12px) !important;
    animation: slideInScale 0.3s ease-out !important;
    overflow-y: auto !important;
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInScale {
      from {
        transform: translate(-50%, -50%) scale(0.9);
        opacity: 0;
      }
      to {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
  
  testOverlay.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 40px; height: 40px; border-radius: 50%; 
          background: linear-gradient(45deg, #3b82f6, #1d4ed8);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
        ">🔌</div>
        <div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 600;">Data-IO Connection Test</h2>
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">Testing server connection and authentication</p>
        </div>
      </div>
      
      <button id="close-test" style="
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        width: 32px; height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">✕</button>
    </div>
    
    <div id="test-content">
      <div style="text-align: center; padding: 40px 20px;">
        <div style="
          width: 48px; height: 48px; 
          border: 3px solid #3b82f6; 
          border-top: 3px solid transparent; 
          border-radius: 50%; 
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        "></div>
        <p style="color: #94a3b8;">Initializing connection test...</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(testOverlay);
  
  // Add event listeners
  const closeButton = document.getElementById('close-test');
  if (closeButton) {
    closeButton.onclick = hideConnectionTest;
  }
  
  // Close on escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideConnectionTest();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // Close on backdrop click
  testOverlay.onclick = (e) => {
    if (e.target === testOverlay) {
      hideConnectionTest();
    }
  };
}

async function runConnectionTest(projectId?: string) {
  if (!testOverlay) return;
  
  const contentDiv = document.getElementById('test-content');
  if (!contentDiv) return;
  
  // Show running state
  contentDiv.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="
          width: 20px; height: 20px; 
          border: 2px solid #3b82f6; 
          border-top: 2px solid transparent; 
          border-radius: 50%; 
          animation: spin 1s linear infinite;
        "></div>
        <span style="color: #3b82f6; font-weight: 500;">Running connection tests...</span>
      </div>
      <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 12px;">
        <div style="font-size: 12px; color: #94a3b8;">
          Testing authentication, file upload, and session management
        </div>
      </div>
    </div>
    
    <div id="test-steps">
      <div class="test-step" data-step="health">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b; animation: pulse 2s infinite;"></div>
          <span>Service Health Check</span>
        </div>
      </div>
      
      <div class="test-step" data-step="auth">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b;"></div>
          <span>JWT Token Generation</span>
        </div>
      </div>
      
      <div class="test-step" data-step="upload">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b;"></div>
          <span>File Upload Test</span>
        </div>
      </div>
      
      <div class="test-step" data-step="session">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b;"></div>
          <span>Session Submission Test</span>
        </div>
      </div>
      
      <div class="test-step" data-step="retrieval">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b;"></div>
          <span>Session Retrieval Test</span>
        </div>
      </div>
    </div>
  `;
  
  try {
    // First, run diagnostics
    console.log('🔍 Running configuration diagnostics...');
    const diagnostics = await dataIOClient.diagnoseConfiguration();
    console.log('Configuration diagnostics:', diagnostics);
    
    // Test backend connectivity
    console.log('🔍 Testing backend connectivity...');
    const connectivityResults = await dataIOClient.testBackendConnectivity();
    console.log('Backend connectivity results:', connectivityResults);
    
    // Run the actual test
    const testProject = projectId || 'test-connection-project';
    console.log('Starting connection test for project:', testProject);
    
    const results = await dataIOClient.testConnectionAndAuth(testProject);
    console.log('Connection test completed:', results);
    
    // Display results with all diagnostic info
    displayTestResults(results, connectivityResults, diagnostics);
    
  } catch (error) {
    console.error('Connection test failed with error:', error);
    displayTestError(error);
  }
}

async function runConnectionTestFromBackground(projectId?: string) {
  if (!testOverlay) return;
  
  const contentDiv = document.getElementById('test-content');
  if (!contentDiv) return;
  
  // Show running state
  contentDiv.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="
          width: 20px; height: 20px; 
          border: 2px solid #3b82f6; 
          border-top: 2px solid transparent; 
          border-radius: 50%; 
          animation: spin 1s linear infinite;
        "></div>
        <span style="color: #3b82f6; font-weight: 500;">Running connection tests via background script...</span>
      </div>
      <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 12px;">
        <div style="font-size: 12px; color: #94a3b8;">
          Testing from extension background to avoid CORS issues
        </div>
      </div>
    </div>
    
    <div id="test-steps">
      <div class="test-step" data-step="health">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b; animation: pulse 2s infinite;"></div>
          <span>Service Health Check</span>
        </div>
      </div>
      
      <div class="test-step" data-step="auth">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b;"></div>
          <span>JWT Token Generation</span>
        </div>
      </div>
      
      <div class="test-step" data-step="upload">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b;"></div>
          <span>File Upload Test</span>
        </div>
      </div>
      
      <div class="test-step" data-step="session">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div class="step-icon" style="width: 16px; height: 16px; border-radius: 50%; background: #64748b;"></div>
          <span>Session Submission Test</span>
        </div>
      </div>
    </div>
  `;
  
  try {
    // Send test request to background script
    const testProject = projectId || 'test-connection-project';
    console.log('📡 Sending test request to background script for project:', testProject);
    
    const response = await chrome.runtime.sendMessage({
      type: 'DATA_IO_TEST_CONNECTION',
      projectId: testProject,
      screenDimensions: {
        width: screen.width,
        height: screen.height
      }
    });
    
    if (response.success) {
      console.log('✅ Background test completed successfully:', response);
      
      // Display results from background script
      displayTestResults(response.testResults, response.connectivity, response.diagnostics);
    } else {
      console.error('❌ Background test failed:', response.error);
      displayTestError(new Error(response.error));
    }
    
  } catch (error) {
    console.error('Connection test failed with error:', error);
    displayTestError(error);
  }
}

function displayTestResults(results: TestResults, connectivityResults?: any, diagnostics?: any) {
  if (!testOverlay) return;
  
  const contentDiv = document.getElementById('test-content');
  if (!contentDiv) return;
  
  const overallStatus = results.success ? 'success' : 'error';
  const statusColor = results.success ? '#10b981' : '#ef4444';
  const statusIcon = results.success ? '✅' : '❌';
  
  contentDiv.innerHTML = `
    <!-- Summary -->
    <div style="
      background: ${results.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
      border: 1px solid ${results.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    ">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="font-size: 24px;">${statusIcon}</div>
        <div>
          <div style="font-weight: 600; font-size: 16px; color: ${statusColor};">
            ${results.success ? 'All Tests Passed' : 'Some Tests Failed'}
          </div>
          <div style="font-size: 12px; color: #94a3b8;">
            ${results.summary.successfulSteps}/${results.summary.totalSteps} steps completed in ${results.summary.totalTime}ms
          </div>
        </div>
      </div>
      
      ${!results.success ? `
        <div style="font-size: 12px; color: #fbbf24; margin-top: 8px;">
          ⚠️ Some functionality may not work properly. Check the details below.
        </div>
      ` : `
        <div style="font-size: 12px; color: #10b981; margin-top: 8px;">
          🎉 Your browser plugin is fully connected to the data-io server!
        </div>
      `}
    </div>
    
    <!-- Configuration Diagnostics -->
    ${diagnostics ? `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #e2e8f0;">Configuration</h3>
        <div style="
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          font-size: 12px;
          font-family: monospace;
        ">
          <div style="margin-bottom: 8px;">
            <strong>Extension:</strong><br>
            ID: ${diagnostics.backendConnectivity.extensionId || 'Unknown'}<br>
            Origin: ${diagnostics.backendConnectivity.extensionOrigin || 'Unknown'}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>API URLs:</strong><br>
            Backend: ${diagnostics.configuration.API_BASE_URL}<br>
            Data-IO: ${diagnostics.configuration.DATA_IO_URL}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Authentication:</strong><br>
            Clerk Token: ${diagnostics.authentication.hasClerkToken ? '✅ Present' : '❌ Missing'} 
            ${diagnostics.authentication.clerkTokenLength ? `(${diagnostics.authentication.clerkTokenLength} chars)` : ''}<br>
            User ID: ${diagnostics.authentication.clerkUserId || 'Not available'}<br>
            Selected Project: ${diagnostics.authentication.selectedProject ? 
              `✅ ${diagnostics.authentication.selectedProject.name} (${diagnostics.authentication.selectedProject.id})` : 
              '❌ No project selected'}
          </div>
          <div>
            <strong>Backend Health:</strong><br>
            Status: ${diagnostics.backendConnectivity.accessible ? '✅ Accessible' : '❌ Failed'}<br>
            ${diagnostics.backendConnectivity.error ? `Error: ${diagnostics.backendConnectivity.error}` : ''}
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Backend Connectivity -->
    ${connectivityResults ? `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #e2e8f0;">URL Testing</h3>
        <div style="
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
        ">
          ${connectivityResults.results.map((result: any) => `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="
                  width: 12px; height: 12px; border-radius: 50%; 
                  background: ${result.accessible ? '#10b981' : '#ef4444'};
                "></div>
                <span style="font-size: 12px; font-family: monospace;">${result.url}</span>
              </div>
              <div style="font-size: 11px; color: #94a3b8;">
                ${result.accessible ? `${result.responseTime}ms` : 'Failed'}
              </div>
            </div>
            ${result.error ? `
              <div style="font-size: 11px; color: #fca5a5; margin-left: 20px; margin-bottom: 6px;">
                ${result.error}
              </div>
            ` : ''}
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <!-- Detailed Results -->
    <div style="margin-bottom: 20px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #e2e8f0;">Test Results</h3>
      
      ${results.results.map((result, index) => `
        <div style="
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="
                width: 20px; height: 20px; border-radius: 50%; 
                background: ${result.success ? '#10b981' : '#ef4444'};
                display: flex; align-items: center; justify-content: center;
                font-size: 12px;
              ">${result.success ? '✓' : '✗'}</div>
              <span style="font-weight: 500;">${result.step}</span>
            </div>
            <div style="font-size: 12px; color: #94a3b8;">
              ${result.duration}ms
            </div>
          </div>
          
          ${result.error ? `
            <div style="
              background: rgba(239, 68, 68, 0.1);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 6px;
              padding: 8px;
              font-size: 12px;
              color: #fca5a5;
              margin-top: 8px;
            ">
              <strong>Error:</strong> ${result.error}
            </div>
          ` : ''}
          
          ${result.details && result.success ? `
            <details style="margin-top: 8px;">
              <summary style="cursor: pointer; font-size: 12px; color: #94a3b8;">Show Details</summary>
              <pre style="
                background: rgba(0, 0, 0, 0.2);
                border-radius: 4px;
                padding: 8px;
                font-size: 11px;
                color: #e2e8f0;
                margin: 8px 0 0 0;
                overflow-x: auto;
                white-space: pre-wrap;
              ">${JSON.stringify(result.details, null, 2)}</pre>
            </details>
          ` : ''}
        </div>
      `).join('')}
    </div>
    
    <!-- Actions -->
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      ${!results.success ? `
        <button id="retry-test" style="
          background: linear-gradient(45deg, #3b82f6, #1d4ed8);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        ">Retry Test</button>
      ` : ''}
      
      <button id="copy-results" style="
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      ">Copy Results</button>
      
      <button id="close-results" style="
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      ">Close</button>
    </div>
  `;
  
  // Add event listeners
  const retryButton = document.getElementById('retry-test');
  if (retryButton) {
    retryButton.onclick = () => runConnectionTest();
  }
  
  const copyButton = document.getElementById('copy-results');
  if (copyButton) {
    copyButton.onclick = () => {
      const resultText = `Cogix Data-IO Connection Test Results\n${'='.repeat(45)}\n\n` +
        `Overall Status: ${results.success ? 'PASSED' : 'FAILED'}\n` +
        `Steps: ${results.summary.successfulSteps}/${results.summary.totalSteps}\n` +
        `Total Time: ${results.summary.totalTime}ms\n\n` +
        results.results.map(r => 
          `${r.success ? '✓' : '✗'} ${r.step}: ${r.success ? 'PASSED' : 'FAILED'} (${r.duration}ms)\n` +
          (r.error ? `  Error: ${r.error}\n` : '')
        ).join('');
      
      navigator.clipboard.writeText(resultText).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy Results';
        }, 2000);
      });
    };
  }
  
  const closeButton = document.getElementById('close-results');
  if (closeButton) {
    closeButton.onclick = hideConnectionTest;
  }
}

function displayTestError(error: any) {
  if (!testOverlay) return;
  
  const contentDiv = document.getElementById('test-content');
  if (!contentDiv) return;
  
  contentDiv.innerHTML = `
    <div style="
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h3 style="margin: 0 0 8px 0; color: #ef4444;">Test Failed to Run</h3>
      <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px;">
        Could not execute the connection test
      </p>
      <div style="
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        padding: 12px;
        font-family: monospace;
        font-size: 12px;
        color: #fca5a5;
        text-align: left;
        margin-bottom: 16px;
      ">
        ${error instanceof Error ? error.message : String(error)}
      </div>
      <button id="retry-failed-test" style="
        background: linear-gradient(45deg, #3b82f6, #1d4ed8);
        border: none;
        color: white;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      ">Try Again</button>
    </div>
  `;
  
  const retryButton = document.getElementById('retry-failed-test');
  if (retryButton) {
    retryButton.onclick = () => runConnectionTest();
  }
}
