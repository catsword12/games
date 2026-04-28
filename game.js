// Minimal RPG framework: map, player, NPC, simple combat, inventory, UI hooks.
// Extend classes below to add skills, items, quests, animations, save/load, etc.

class Util {
  static clamp(v,a,b){return Math.max(a,Math.min(b,v))}
}

class Input {
  constructor(){
    this.keys = new Set();
    window.addEventListener('keydown', e => {
      this.keys.add(e.key);
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.key);
    });
  }
  isDown(key){ return this.keys.has(key); }
}

class Entity {
  constructor(x,y,opts={}){
    this.x = x; this.y = y;
    this.w = opts.w || 1; this.h = opts.h || 1;
    this.color = opts.color || '#fff';
    this.name = opts.name || 'Entity';
    this.solid = opts.solid ?? true;
  }
  rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h} }
}

class Player extends Entity {
  constructor(x,y){
    super(x,y,{color:'#ffd166',name:'Hero'});
    this.hp = 100;
    this.maxHp = 100;
    this.gold = 0;
    this.speed = 1; // tiles per move
    this.inventory = [];
  }
  heal(amount){ this.hp = Util.clamp(this.hp+amount,0,this.maxHp) }
  addItem(item){ this.inventory.push(item) }
}

class NPC extends Entity {
  constructor(x,y,opts={}){
    super(x,y,opts);
    this.talk = opts.talk || null; // string or function(game) -> dialog
    this.hostile = opts.hostile || false;
    this.stats = opts.stats || {hp:20,atk:5}
  }
}

class TileMap {
  constructor(cols,rows,tileSize){
    this.cols=cols; this.rows=rows; this.tileSize=tileSize;
    // simple map: 0 floor, 1 wall
    this.grid = new Array(rows).fill(0).map(()=> new Array(cols).fill(0));
  }
  isBlocked(col,row){
    if(col<0||row<0||col>=this.cols||row>=this.rows) return true;
    return this.grid[row][col] === 1;
  }
  setWall(col,row){ this.grid[row][col]=1 }
}

class Renderer {
  constructor(canvas, map){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = map;
  }
  clear(){ this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height) }
  drawMap(){
    const ctx = this.ctx, ts = this.map.tileSize;
    for(let r=0;r<this.map.rows;r++){
      for(let c=0;c<this.map.cols;c++){
        const v = this.map.grid[r][c];
        if(v===1) ctx.fillStyle = '#3b3f45';
        else ctx.fillStyle = '#233040';
        ctx.fillRect(c*ts, r*ts, ts, ts);
        // grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.strokeRect(c*ts, r*ts, ts, ts);
      }
    }
  }
  drawEntity(e){
    const ts = this.map.tileSize;
    const ctx = this.ctx;
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x*ts + 2, e.y*ts + 2, ts-4, ts-4);
  }
}

class CombatSystem {
  constructor(game){
    this.game = game;
  }
  startCombat(npc){
    const g = this.game;
    g.state = 'combat';
    g.currentEnemy = npc;
    g.ui.showCombat(`${npc.name} attacks!`);
  }
  playerAttack(){
    const g=this.game, e = g.currentEnemy;
    const dmg = 6 + Math.floor(Math.random()*4);
    e.stats.hp = (e.stats.hp || 10) - dmg;
    g.ui.appendCombatLog(`You hit ${e.name} for ${dmg} dmg.`);
    if(e.stats.hp <= 0){
      g.ui.appendCombatLog(`${e.name} defeated!`);
      g.state = 'playing';
      g.currentEnemy = null;
      g.ui.hideCombat();
      g.player.gold += 5;
      g.ui.updateHud();
      return;
    }
    // enemy turn
    this.enemyTurn();
  }
  enemyTurn(){
    const g=this.game, e = g.currentEnemy;
    const dmg = (e.stats.atk||3) + Math.floor(Math.random()*3);
    g.player.hp = Util.clamp(g.player.hp - dmg, 0, g.player.maxHp);
    g.ui.appendCombatLog(`${e.name} hits you for ${dmg} dmg.`);
    g.ui.updateHud();
    if(g.player.hp<=0){
      g.ui.appendCombatLog(`You have been defeated...`);
      g.state = 'dead';
      // simple respawn
      setTimeout(()=> g.reset(), 1500);
    }
  }
}

class UI {
  constructor(game){
    this.game = game;
    this.dialogEl = document.getElementById('dialog');
    this.combatEl = document.getElementById('combat');
    this.invEl = document.getElementById('inventory');
    this.hudHp = document.getElementById('hp-val');
    this.hudGold = document.getElementById('gold-val');
    this.combatLog = document.getElementById('combat-log');
    document.getElementById('btn-attack').addEventListener('click', ()=> game.combat.playerAttack());
    document.getElementById('btn-run').addEventListener('click', ()=> { this.hideCombat(); game.state='playing'; });
    this.invList = document.getElementById('inv-list');
  }
  showDialog(text){
    this.dialogEl.textContent = text;
    this.dialogEl.classList.remove('hidden');
  }
  hideDialog(){ this.dialogEl.classList.add('hidden') }
  showCombat(initial){
    this.combatLog.innerHTML = '';
    this.appendCombatLog(initial);
    this.combatEl.classList.remove('hidden');
  }
  appendCombatLog(text){
    const el = document.createElement('div');
    el.textContent = text;
    this.combatLog.appendChild(el);
    this.combatLog.scrollTop = this.combatLog.scrollHeight;
  }
  hideCombat(){ this.combatEl.classList.add('hidden') }
  showInventory(){
    this.invEl.classList.remove('hidden');
    this.renderInv();
  }
  hideInventory(){ this.invEl.classList.add('hidden') }
  renderInv(){
    this.invList.innerHTML = '';
    this.game.player.inventory.forEach((it,idx)=>{
      const li = document.createElement('li');
      li.textContent = `${it.name} x${it.qty||1}`;
      this.invList.appendChild(li);
    });
  }
  updateHud(){
    this.hudHp.textContent = this.game.player.hp;
    this.hudGold.textContent = this.game.player.gold;
  }
}

class Game {
  constructor(canvas){
    this.canvas = canvas;
    this.map = new TileMap(20,15,32);
    this.renderer = new Renderer(canvas,this.map);
    this.input = new Input();
    this.player = new Player(2,2);
    this.entities = [];
    this.state = 'playing'; // playing | combat | dialog | dead
    this.combat = new CombatSystem(this);
    this.ui = new UI(this);
    this.currentEnemy = null;
    this._setup();
    this._bind();
    this.lastTick = performance.now();
    requestAnimationFrame((t)=>this.loop(t));
  }

  _setup(){
    // make a border wall
    for(let c=0;c<this.map.cols;c++){
      this.map.setWall(c,0); this.map.setWall(c,this.map.rows-1);
    }
    for(let r=0;r<this.map.rows;r++){
      this.map.setWall(0,r); this.map.setWall(this.map.cols-1,r);
    }
    // add some random walls
    for(let i=0;i<40;i++){
      const c = 2+Math.floor(Math.random()*(this.map.cols-4));
      const r = 2+Math.floor(Math.random()*(this.map.rows-4));
      this.map.setWall(c,r);
    }

    // add NPCs
    this.entities.push(new NPC(8,6,{color:'#ff6b6b',name:'Goblin',hostile:true,stats:{hp:20,atk:4}}));
    this.entities.push(new NPC(12,9,{color:'#8ecae6',name:'Shopkeeper',hostile:false,talk:"Welcome! Press Space to open your inventory."}));

    // sample item in inventory
    this.player.addItem({name:'Potion',qty:2});
    this.ui.updateHud();
  }

  _bind(){
    // quick keys
    window.addEventListener('keydown',(e)=>{
      if(e.key === 'i'){ this.ui.showInventory(); }
      if(e.key === 'Escape'){ this.ui.hideInventory(); this.ui.hideDialog() }
      if(e.key === ' '){ this.interact(); e.preventDefault(); }
    });
  }

  interact(){
    if(this.state !== 'playing') return;
    // check for adjacent entities
    const adj = this.getAdjacentEntity();
    if(adj){
      if(adj.hostile) this.combat.startCombat(adj);
      else {
        if(typeof adj.talk === 'string') this.ui.showDialog(adj.talk);
        else if(typeof adj.talk === 'function') this.ui.showDialog(adj.talk(this));
      }
    }
  }

  getAdjacentEntity(){
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
    for(const d of dirs){
      const tx = this.player.x + d[0], ty = this.player.y + d[1];
      for(const e of this.entities){
        if(e.x === tx && e.y === ty) return e;
      }
    }
    return null;
  }

  canMoveTo(x,y){
    if(this.map.isBlocked(x,y)) return false;
    for(const e of this.entities){
      if(e.solid && e.x===x && e.y===y) return false;
    }
    return true;
  }

  update(dt){
    if(this.state !== 'playing') return;
    // simple grid movement with arrow keys
    const moveKeys = [
      {k:'ArrowUp', dx:0, dy:-1},
      {k:'w', dx:0, dy:-1},
      {k:'ArrowDown', k2:'s', dx:0, dy:1},
    ];
    // handle more generically:
    let moved = false;
    let dx=0,dy=0;
    if(this.input.isDown('ArrowUp') || this.input.isDown('w')) { dy=-1; moved=true; }
    else if(this.input.isDown('ArrowDown') || this.input.isDown('s')) { dy=1; moved=true; }
    else if(this.input.isDown('ArrowLeft') || this.input.isDown('a')) { dx=-1; moved=true; }
    else if(this.input.isDown('ArrowRight') || this.input.isDown('d')) { dx=1; moved=true; }

    if(moved){
      const nx = this.player.x + dx, ny = this.player.y + dy;
      if(this.canMoveTo(nx,ny)){
        this.player.x = nx; this.player.y = ny;
        this.ui.hideDialog();
        this.ui.updateHud();
      }
      // simple debouncing: wait a short time before next move
      this.input.keys.clear();
    }
  }

  render(){
    this.renderer.clear();
    this.renderer.drawMap();
    for(const e of this.entities) this.renderer.drawEntity(e);
    this.renderer.drawEntity(this.player);
  }

  loop(ts){
    const dt = ts - this.lastTick;
    this.lastTick = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame((t)=>this.loop(t));
  }

  reset(){
    // basic respawn
    this.player.hp = this.player.maxHp;
    this.player.x = 2; this.player.y = 2;
    this.state = 'playing';
    this.ui.updateHud();
    this.ui.hideCombat();
  }
}

// instantiate
window.addEventListener('load', ()=>{
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);
  // expose for console tweaking
  window.game = game;
});
