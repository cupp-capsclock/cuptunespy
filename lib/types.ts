/**
 * lib/types.ts
 * Versi Spotify — source 'spotify' menggantikan 'youtube'
 */

export type Source = 'spotify' | 'local';

export interface Track {
  id: string;        // "sp:<spotifyId>" atau "local:<uuid>"
  source: Source;
  videoId?: string;  // Spotify track ID (dipakai PlayerEngine untuk streaming via ytdl/piped/invidious)
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string; // artwork URL dari Spotify
  durationSec?: number;
  addedAt?: number;
}

export type ItemKind = 'video' | 'channel' | 'playlist';

export interface SearchItem {
  kind: ItemKind;
  id: string;
  title: string;
  subtitle: string;
  thumb: string;
  durationSec?: number;
  sourceUrl?: string;    // URL Spotify asli
  spotifyType?: string;  // 'track' | 'artist' | 'album' | 'playlist' dll
}

export interface SearchResponse {
  items: SearchItem[];
  nextPageToken?: string;
}

export interface PlaylistResponse {
  id: string;
  title: string;
  description: string;
  channel: string;
  thumb: string;
  items: SearchItem[];
  nextPageToken?: string;
}

export type ErrorCode =
  | 'NO_KEY' | 'INVALID_KEY' | 'QUOTA' | 'RATE_LIMIT' | 'TIMEOUT'
  | 'BAD_RESPONSE' | 'NOT_FOUND' | 'BAD_REQUEST' | 'UPSTREAM' | 'NETWORK';

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tracks: Track[];
}
