import { sim } from '../state';

const i = (x:number) => Math.max(0, Math.round(x)); // display ints

export function updateHUD(){
  // HP as integers
  const lCenter = i(sim.coreL?.centerHP ?? 0);
  const rCenter = i(sim.coreR?.centerHP ?? 0);
  const lSegSum = i((sim.coreL?.segHP ?? []).reduce((a,b)=> a + Math.max(0,b), 0));
  const rSegSum = i((sim.coreR?.segHP ?? []).reduce((a,b)=> a + Math.max(0,b), 0));

  (document.getElementById('hpL')!).textContent = `${lCenter}|Σ${lSegSum}`;
  (document.getElementById('hpR')!).textContent = `${rCenter}|Σ${rSegSum}`;

  // State derived every frame so it never gets stuck
  let state = sim.started ? 'Running' : 'Idle';
  if (sim.coreL && sim.coreR && (sim.coreL.centerHP <= 0 || sim.coreR.centerHP <= 0)) {
    state = 'Game Over';
  }
  (document.getElementById('state')!).textContent = state;
}

// still useful for one-off overrides if you add phases later
export function setState(text:string){ (document.getElementById('state')!).textContent = text; }
export function setButtons(running:boolean){
  (document.getElementById('btnStart') as HTMLButtonElement).disabled = running;
  (document.getElementById('btnStop')  as HTMLButtonElement).disabled = !running;
}
