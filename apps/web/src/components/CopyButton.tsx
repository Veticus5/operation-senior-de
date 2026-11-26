import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState('Kopiuj');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setLabel('Skopiowano');
    } catch {
      setLabel('Zaznacz i skopiuj ręcznie');
    }
    setTimeout(() => setLabel('Kopiuj'), 1800);
  };
  return (
    <button type="button" className="copy" onClick={copy}>
      {label}
    </button>
  );
}
