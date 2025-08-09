export enum Side { LEFT = -1, RIGHT = 1 }
export type Vec = { x:number; y:number };
export type AmmoType = 'basic'|'heavy'|'volatile'|'emp'|'repair'|'shield';
export interface Settings {
  seed: number; chaos: number; spawnRate: number; targetAmmo: number; timescale: number; loop:boolean;
}
export interface Core {
  side: Side; color: string; radius:number; center: Vec; rot:number; rotSpeed:number;
  segHP: number[]; segHPmax:number; centerHP:number; centerHPmax:number;
  centerBody: Matter.Body; ringBody: Matter.Body; shield:number;
}
export interface Bins { [k:string]: { body: Matter.Body; accept: AmmoType[]; fill:number; cap:number; label:string } }
export type Bins = {
  cannon: any; laser: any; missile: any;
  mortar: any; shield: any; repair: any;
  buff?: any;  debuff?: any; // NEW
};