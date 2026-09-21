export interface CrossoverLatency {
  samplerate: number
  filters: { [name: string]: number }
  channels: number[]
  total: number
  total_ms: number
}

/** Latency added by the crossover filters of a config, all values in samples. */
export function fetchCrossoverLatency(config: object, samplerate?: number): Promise<CrossoverLatency> {
  return fetch("/api/crossoverlatency", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, samplerate }),
  }).then((response) => {
    if (!response.ok) return response.text().then((text) => Promise.reject(new Error(text)))
    return response.json() as Promise<CrossoverLatency>
  })
}

export function formatLatency(samples: number, samplerate: number): string {
  const ms = (1000 * samples) / samplerate
  return `${samples} samples (${ms.toFixed(1)} ms)`
}
