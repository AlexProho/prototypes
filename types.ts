export enum GameState {
  Ready,
  Active,
  Paused,
  GameOver,
}

export interface PlayerState {
  x: number;
  width: number;
  height: number;
}

export interface FallingObject {
  id: number;
  x: number;
  y: number;
  size: number;
}
