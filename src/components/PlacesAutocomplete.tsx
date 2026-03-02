import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface PlacePrediction {
  description: string;
  place_id: string;
  main_text?: string;
  secondary_text?: string;
}

export const PlacesAutocomplete = ({
  value,
  onChange,
  placeholder = 'e.g. 123 Main St, Ottawa, ON K1A 0A1',
  className = '',
}: PlacesAutocompleteProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState('');

  const trimmedValue = value.trim();
  const shouldQuery = isFocused && trimmedValue.length >= 3;

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!shouldQuery) {
      setLoading(false);
      setError('');
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setError('');

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const accessToken = session?.access_token;
        if (!accessToken) {
          if (!cancelled) {
            setSuggestions([]);
            setError('Please sign in to use address lookup.');
          }
          return;
        }

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/places-autocomplete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ query: trimmedValue }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || 'Address lookup failed');
        }

        if (!cancelled) {
          setSuggestions(Array.isArray(json.predictions) ? json.predictions : []);
        }
      } catch (err) {
        if (!cancelled) {
          setSuggestions([]);
          setError(err instanceof Error ? err.message : 'Address lookup failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [shouldQuery, trimmedValue]);

  const showDropdown = isFocused && (loading || suggestions.length > 0 || !!error) && trimmedValue.length >= 3;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
      </div>
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          {error && (
            <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}
          {!error && suggestions.length === 0 && !loading && (
            <div className="px-3 py-2 text-xs text-slate-500">No addresses found.</div>
          )}
          {suggestions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(prediction.description);
                setSuggestions([]);
                setIsFocused(false);
                inputRef.current?.blur();
              }}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
            >
              <div className="text-sm text-slate-800">{prediction.main_text || prediction.description}</div>
              {prediction.secondary_text && (
                <div className="text-xs text-slate-500 mt-0.5">{prediction.secondary_text}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
