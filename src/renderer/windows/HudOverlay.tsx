import React, { useEffect, useState } from 'react';

/**
 * Transparent HUD overlay that shows status messages.
 * Appears briefly during correction: "Working...", "Done!", or error messages.
 */
export default function HudOverlay() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const offShow = window.ghostedit.onHudShow((msg) => {
      setMessage(msg);
      setVisible(true);
    });
    const offHide = window.ghostedit.onHudHide(() => {
      setVisible(false);
    });
    return () => {
      offShow();
      offHide();
    };
  }, []);

  const isError = message.startsWith('Error');
  const isDone = message === 'Done!' || message.includes('clipboard');

  return (
    <div
      className={`flex items-center justify-center h-screen transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`px-6 py-3 rounded-xl shadow-2xl backdrop-blur-xl border border-white/10 ${
          isError
            ? 'bg-ghost-error/90 text-[#282a36]'
            : isDone
              ? 'bg-ghost-success/90 text-[#282a36]'
              : 'bg-[#282a36]/95 text-[#f8f8f2]'
        }`}
      >
        <div className="flex items-center gap-2">
          {!isError && !isDone && (
            <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          <span className="text-sm font-medium">{message}</span>
        </div>
      </div>
    </div>
  );
}
