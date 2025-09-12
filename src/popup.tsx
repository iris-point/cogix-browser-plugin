import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RootLayout } from './popup/layouts/root-layout'
import { HomePage } from './popup/pages/home'
import { SignInPage } from './popup/pages/sign-in'
import { SignUpPage } from './popup/pages/sign-up'
import { SettingsPage } from './popup/pages/settings'
import { DebugPage } from './popup/pages/debug'
import { EyeTrackingPage } from './popup/pages/eye-tracking'
import { SDKPage } from './popup/pages/sdk'
import { TestConnectionPage } from './popup/pages/test-connection'
import "~style.css"

function IndexPopup() {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="sign-in" element={<SignInPage />} />
          <Route path="sign-up" element={<SignUpPage />} />
          <Route path="eye-tracking" element={<EyeTrackingPage />} />
          <Route path="sdk" element={<SDKPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="debug" element={<DebugPage />} />
          <Route path="test-connection" element={<TestConnectionPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

export default IndexPopup
