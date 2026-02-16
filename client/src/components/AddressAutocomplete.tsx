import { usePlacesWidget } from "react-google-autocomplete";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface AddressComponents {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (components: AddressComponents) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address...",
  className,
  disabled,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const { ref } = usePlacesWidget<HTMLInputElement>({
    apiKey: GOOGLE_MAPS_API_KEY,
    onPlaceSelected: (place) => {
      if (!place?.address_components) return;

      const getComponent = (type: string): string => {
        const component = place.address_components?.find((c: { types: string[]; long_name: string }) =>
          c.types.includes(type)
        );
        return component?.long_name || "";
      };

      const streetNumber = getComponent("street_number");
      const route = getComponent("route");
      const address = streetNumber ? `${streetNumber} ${route}` : route;
      const suburb = getComponent("locality") || getComponent("sublocality_level_1");
      const state = getComponent("administrative_area_level_1");
      const postcode = getComponent("postal_code");
      const country = getComponent("country");

      onChange(place.formatted_address || address);

      if (onPlaceSelect) {
        onPlaceSelect({
          address: address || place.formatted_address || "",
          suburb,
          state,
          postcode,
          country,
        });
      }
    },
    options: {
      types: ["address"],
      componentRestrictions: { country: "au" },
      fields: ["address_components", "formatted_address", "geometry"],
    },
  });

  useEffect(() => {
    if (ref.current && ref.current.value !== value) {
      ref.current.value = value;
    }
  }, [value, ref]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        data-testid={testId}
      />
    );
  }

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      disabled={disabled}
      data-testid={testId}
    />
  );
}
