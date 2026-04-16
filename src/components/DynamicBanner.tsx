import { useState, useEffect } from "react";
import { Sun, Moon, Sunrise, Sunset, Cloud, CloudRain, Loader2, MapPin } from "lucide-react";

interface WeatherData {
  temperature: number;
  condition: "clear" | "cloudy" | "rainy";
}

interface LocationData {
  neighborhood: string;
  city: string;
}

const GV_COORDS = {
  latitude: -18.8514,
  longitude: -41.9499,
};

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const getTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
};

const getGreeting = (timeOfDay: TimeOfDay): string => {
  switch (timeOfDay) {
    case "morning":
      return "Bom dia";
    case "afternoon":
      return "Boa tarde";
    case "evening":
      return "Boa tarde";
    case "night":
      return "Boa noite";
  }
};

const getTimeIcon = (timeOfDay: TimeOfDay) => {
  switch (timeOfDay) {
    case "morning":
      return Sunrise;
    case "afternoon":
      return Sun;
    case "evening":
      return Sunset;
    case "night":
      return Moon;
  }
};

const getGradient = (timeOfDay: TimeOfDay): string => {
  switch (timeOfDay) {
    case "morning":
      return "bg-gradient-to-br from-amber-200 via-orange-300 to-yellow-200";
    case "afternoon":
      return "bg-gradient-to-br from-sky-400 via-blue-400 to-cyan-300";
    case "evening":
      return "bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500";
    case "night":
      return "bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900";
  }
};

const getTextColor = (timeOfDay: TimeOfDay): string => {
  return timeOfDay === "night" ? "text-white" : "text-slate-800";
};

const getWeatherIcon = (condition: WeatherData["condition"]) => {
  switch (condition) {
    case "rainy":
      return CloudRain;
    case "cloudy":
      return Cloud;
    default:
      return null;
  }
};

interface DynamicBannerProps {
  userName?: string;
}

const DynamicBanner = ({ userName = "Visitante" }: DynamicBannerProps) => {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(getTimeOfDay());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchLocationName = async (latitude: number, longitude: number) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "pt-BR",
            },
          }
        );
        const data = await response.json();
        
        const address = data.address;
        const neighborhood = 
          address.suburb || 
          address.neighbourhood || 
          address.district || 
          address.city_district || 
          "";
        const city = address.city || address.town || address.municipality || "";

        setLocation({ neighborhood, city });
      } catch (error) {
        console.error("Erro ao buscar localização:", error);
      }
    };

    const fetchWeather = async (latitude: number, longitude: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
        );
        const data = await response.json();
        
        const weatherCode = data.current.weather_code;
        let condition: WeatherData["condition"] = "clear";
        
        if (weatherCode >= 61 && weatherCode <= 99) {
          condition = "rainy";
        } else if (weatherCode >= 3 && weatherCode <= 60) {
          condition = "cloudy";
        }

        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          condition,
        });
      } catch (error) {
        console.error("Erro ao buscar clima:", error);
        setWeather({ temperature: 25, condition: "clear" });
      } finally {
        setLoading(false);
      }
    };

    const getLocationData = () => {
      setLocationError(false);
      fetchWeather(GV_COORDS.latitude, GV_COORDS.longitude);
      fetchLocationName(GV_COORDS.latitude, GV_COORDS.longitude);
    };

    getLocationData();
  }, []);

  const TimeIcon = getTimeIcon(timeOfDay);
  const WeatherIcon = weather ? getWeatherIcon(weather.condition) : null;
  const gradient = getGradient(timeOfDay);
  const textColor = getTextColor(timeOfDay);

  return (
    <div className={`relative overflow-hidden ${gradient} p-6`}>
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 opacity-20">
        <TimeIcon className={`h-32 w-32 ${textColor}`} />
      </div>

      {/* Content */}
      <div className={`relative z-10 ${textColor}`}>
        <div className="flex items-center gap-2 mb-2">
          <TimeIcon className="h-5 w-5" />
          <span className="text-sm font-medium opacity-80">
            {getGreeting(timeOfDay)}
          </span>
        </div>

        <p className="text-lg font-medium mb-3">
          Olá, {userName}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : weather ? (
              <div className="flex items-center gap-2">
                {WeatherIcon && <WeatherIcon className="h-5 w-5" />}
                <span className="text-lg font-semibold">{weather.temperature}°C</span>
              </div>
            ) : null}
          </div>

          {location?.neighborhood && (
            <div className="flex items-center gap-1 text-sm opacity-80">
              <MapPin className="h-4 w-4" />
              <span>{location.neighborhood}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DynamicBanner;
