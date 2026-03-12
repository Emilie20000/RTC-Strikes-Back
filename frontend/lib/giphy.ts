const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY as string;

export interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_height_small: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
      width: string;
      height: string;
    };
  };
}

export interface GiphyResponse {
  data: GiphyGif[];
  pagination: {
    total_count: number;
    count: number;
    offset: number;
  };
}

const BASE_URL = "https://api.giphy.com/v1/gifs";

export async function fetchTrendingGifs(limit: number = 20, offset: number = 0): Promise<GiphyResponse> {
  const url = new URL(`${BASE_URL}/trending`);
  url.searchParams.append("api_key", GIPHY_API_KEY);
  url.searchParams.append("limit", limit.toString());
  url.searchParams.append("offset", offset.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "No error body");
    throw new Error(`GIPHY API error ${response.status}: ${response.statusText} - ${errorBody}`);
  }
  return response.json();
}

export async function searchGifs(query: string, limit: number = 20, offset: number = 0): Promise<GiphyResponse> {
  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.append("api_key", GIPHY_API_KEY);
  url.searchParams.append("q", query);
  url.searchParams.append("limit", limit.toString());
  url.searchParams.append("offset", offset.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "No error body");
    throw new Error(`GIPHY API error ${response.status}: ${response.statusText} - ${errorBody}`);
  }
  return response.json();
}
