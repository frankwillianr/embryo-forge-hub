import { useState, useEffect } from "react";
import { Sun, Moon, Sunrise, Sunset, Cloud, CloudRain, Loader2 } from "lucide-react";

interface WeatherData {
  temperature: number;
  condition: "clear" | "cloudy" | "rainy";
}

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
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    // Update time of day every minute
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWeather = async (latitude: number, longitude: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
        );
        const data = await response.json();
        
        const weatherCode = data.current.weather_code;
        let condition: WeatherData["condition"] = "clear";
        
        // Weather codes: 0-3 clear/partly cloudy, 45-67 cloudy/foggy, 71+ rain/snow
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

    const getLocation = () => {
      if (!navigator.geolocation) {
        setLocationError(true);
        // Default to São Paulo coordinates
        fetchWeather(-23.5505, -46.6333);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          setLocationError(true);
          // Default to São Paulo coordinates
          fetchWeather(-23.5505, -46.6333);
        }
      );
    };

    getLocation();
  }, []);

  const TimeIcon = getTimeIcon(timeOfDay);
  const WeatherIcon = weather ? getWeatherIcon(weather.condition) : null;
  const gradient = getGradient(timeOfDay);
  const textColor = getTextColor(timeOfDay);

  return (
    <div className={`relative overflow-hidden rounded-2xl ${gradient} p-6 shadow-lg`}>
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

        <h1 className="text-2xl font-bold mb-3">
          Olá, {userName}!
        </h1>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando clima...</span>
            </div>
          ) : weather ? (
            <div className="flex items-center gap-2">
              {WeatherIcon && <WeatherIcon className="h-5 w-5" />}
              <span className="text-lg font-semibold">{weather.temperature}°C</span>
              {locationError && (
                <span className="text-xs opacity-70">(localização padrão)</span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DynamicBanner;
