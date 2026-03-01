import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps?: () => void;
  }
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

let scriptLoaded = false;
let scriptLoading = false;
const callbacks: Array<() => void> = [];

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded) {
      resolve();
      return;
    }
    callbacks.push(resolve);
    if (scriptLoading) return;
    scriptLoading = true;
    window.initGoogleMaps = () => {
      scriptLoaded = true;
      callbacks.forEach((cb) => cb());
      callbacks.length = 0;
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

export const PlacesAutocomplete = ({
  value,
  onChange,
  placeholder = 'e.g. 123 Main St, Ottawa, ON K1A 0A1',
  className = '',
}: PlacesAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(scriptLoaded);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string;
    if (!apiKey) return;
    loadGoogleMapsScript(apiKey).then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      { types: ['address'] }
    );

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current!.getPlace();
      const formatted = place.formatted_address ?? place.name ?? '';
      onChange(formatted);
    });
  }, [ready, onChange]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        {ready ? <MapPin size={14} /> : <Loader2 size={14} className="animate-spin" />}
      </div>
    </div>
  );
};
