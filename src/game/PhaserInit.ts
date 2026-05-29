import Phaser from 'phaser';
import { GameConfig } from './GameConfig';

export function startPhaser(parentId: string): Phaser.Game {
  return new Phaser.Game({ ...GameConfig, parent: parentId });
}
