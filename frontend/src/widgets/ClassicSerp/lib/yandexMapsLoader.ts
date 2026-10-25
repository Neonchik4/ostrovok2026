declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ymaps?: any;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadYandexMapsScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("window is undefined"));
    }
    if (window.ymaps && window.ymaps.ready) {
      window.ymaps.ready(() => resolve(window.ymaps));
      return;
    }

    const scriptId = "yandex-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "text/javascript";
      const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
      const keyParam = apiKey ? `&apikey=${encodeURIComponent(apiKey)}` : "";
      script.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU${keyParam}`;
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", () => {
      if (window.ymaps && window.ymaps.ready) {
        window.ymaps.ready(() => resolve(window.ymaps));
      } else {
        reject(new Error("ymaps global not found"));
      }
    });

    script.addEventListener("error", () => {
      reject(new Error("Failed to load Yandex Maps script"));
    });
  });
}
