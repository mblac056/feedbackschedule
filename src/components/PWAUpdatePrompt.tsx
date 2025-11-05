import { useEffect, useState } from 'react'
// @ts-ignore - virtual module provided by vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered: ', r)
    },
    onRegisterError(error: Error) {
      console.log('SW registration error', error)
    },
  })

  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)

  useEffect(() => {
    if (needRefresh) {
      setShowUpdatePrompt(true)
    }
  }, [needRefresh])

  if (!showUpdatePrompt && !offlineReady) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {offlineReady && (
        <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg mb-2">
          <p className="text-sm font-medium">App ready to work offline</p>
        </div>
      )}
      
      {showUpdatePrompt && (
        <div className="bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium mb-2">New version available!</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                updateServiceWorker(true)
                setShowUpdatePrompt(false)
              }}
              className="bg-white text-blue-500 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Update
            </button>
            <button
              onClick={() => {
                setShowUpdatePrompt(false)
                setNeedRefresh(false)
              }}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

