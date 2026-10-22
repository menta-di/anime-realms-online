(function () {
  const loading = document.getElementById("loading");
  const errorBox = document.getElementById("error");
  const connection = document.getElementById("connection");
  const countEl = document.getElementById("count");
  const notice = document.getElementById("notice");
  const players = new Map();
  let myId = null, ws = null, yaw = 0, pitch = 0.18, locked = false, befriended = false;
  let noticeTime = 0, lastSent = 0;
  const keys = {};

  function fail(message) {
    loading.style.display = "none";
    errorBox.hidden = false;
    errorBox.textContent = message;
  }
  function say(message) { notice.textContent = message; notice.style.display = "block"; noticeTime = 3; }
  if (!window.THREE) { fail("Could not load Three.js. Check your internet connection and refresh."); return; }

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("game"), antialias: false, powerPreference: "low-power" }); }
  catch (e) { fail("WebGL could not start. Check your browser and graphics driver. " + e.message); return; }
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ed9e8);
  scene.fog = new THREE.Fog(0x9ed9e8, 28, 75);
  const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 120);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x58744b, 1.8));
  const sun = new THREE.DirectionalLight(0xfff2d5, 1.2); sun.position.set(-12, 22, 8); scene.add(sun);
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const grass = mat(0x6ab66a), path = mat(0xcbb98a), trunk = mat(0x795238), leaf1 = mat(0x32895a), leaf2 = mat(0x4aa96a);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), grass); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; scene.add(ground);
  for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(4, .025, 3.2), path); p.position.set(0, -.025, 12 - i * 3.4); p.rotation.y = i % 2 ? -.12 : .12; scene.add(p); }
  function tree(x, z, s) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.18*s, .28*s, 1.5*s, 5), trunk); t.position.set(x, .68*s, z); scene.add(t);
    const a = new THREE.Mesh(new THREE.ConeGeometry(.95*s, 2*s, 5), leaf1); a.position.set(x, 1.95*s, z); scene.add(a);
    const b = new THREE.Mesh(new THREE.ConeGeometry(.7*s, 1.45*s, 5), leaf2); b.position.set(x, 2.55*s, z); scene.add(b);
  }
  for (let i=0;i<45;i++){const a=i*2.399,r=10+(i%7)*2.5,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<4&&z<13&&z>-18)continue;tree(x,z,.75+(i%4)*.12);}
  const shrineBase = new THREE.Mesh(new THREE.BoxGeometry(2.5,.25,1.5),mat(0xe9e3cf)); shrineBase.position.set(0,.12,-17); scene.add(shrineBase);
  const postMat=mat(0xb64e4a);
  for(const x of [-.8,.8]){const post=new THREE.Mesh(new THREE.BoxGeometry(.18,2,.18),postMat);post.position.set(x,1.15,-17);scene.add(post);}
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.65,.65,4),postMat);roof.rotation.y=Math.PI/4;roof.position.set(0,2.35,-17);scene.add(roof);

  function makeAvatar(color, hairColor) {
    const g = new THREE.Group(), shirt=mat(color), skin=mat(0xf0c4a0), hair=mat(hairColor), pants=mat(0x283d59), boots=mat(0x49382e);
    function add(geo,m,pos,scale){const o=new THREE.Mesh(geo,m);o.position.set(...pos);if(scale)o.scale.set(...scale);g.add(o);return o;}
    add(new THREE.CylinderGeometry(.28,.34,.75,6),shirt,[0,1.05,0]);
    add(new THREE.SphereGeometry(.28,8,6),skin,[0,1.72,0]);
    add(new THREE.SphereGeometry(.3,7,5),hair,[0,1.9,-.045],[1.04,.72,1.02]);
    add(new THREE.BoxGeometry(.16,.5,.18),pants,[-.13,.43,0]);add(new THREE.BoxGeometry(.16,.5,.18),pants,[.13,.43,0]);
    add(new THREE.BoxGeometry(.19,.12,.3),boots,[-.13,.15,-.035]);add(new THREE.BoxGeometry(.19,.12,.3),boots,[.13,.15,-.035]);
    return g;
  }
  function makeLabel(name) {
    const c=document.createElement("canvas");c.width=256;c.height=64;const ctx=c.getContext("2d");
    ctx.fillStyle="rgba(16,31,48,.82)";ctx.fillRect(4,6,248,52);ctx.fillStyle="#ffffff";ctx.font="bold 26px Arial";ctx.textAlign="center";ctx.fillText(String(name).slice(0,16),128,41);
    const tex=new THREE.CanvasTexture(c);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
    sprite.scale.set(2.4,.6,1);sprite.position.y=2.65;return sprite;
  }
  function createPlayer(p, mine) {
    const color=mine?0x3e75d4:0xc65ad6;
    const avatar=makeAvatar(color,mine?0x28364e:0x4a263d);
    avatar.position.set(p.x||0,0,p.z||0);avatar.rotation.y=p.yaw||0;avatar.add(makeLabel(p.name||"Explorer"));scene.add(avatar);
    players.set(p.id,{...p,avatar,targetX:p.x||0,targetZ:p.z||0,targetYaw:p.yaw||0,mine});
    countEl.textContent=players.size;
  }
  function removePlayer(id){const p=players.get(id);if(p){scene.remove(p.avatar);players.delete(id);countEl.textContent=players.size;}}
  const creature=new THREE.Group();scene.add(creature);const fur=mat(0xffc95c), belly=mat(0xffefb1), ears=mat(0xe98b59), eye=mat(0x20252e);
  function cadd(geo,m,pos,scale){const o=new THREE.Mesh(geo,m);o.position.set(...pos);if(scale)o.scale.set(...scale);creature.add(o);}
  cadd(new THREE.SphereGeometry(.42,8,6),fur,[0,.45,0],[1.1,.9,1]);cadd(new THREE.SphereGeometry(.27,8,6),fur,[0,.88,-.02]);
  cadd(new THREE.ConeGeometry(.13,.38,5),ears,[-.17,1.13,0]);cadd(new THREE.ConeGeometry(.13,.38,5),ears,[.17,1.13,0]);
  cadd(new THREE.SphereGeometry(.055,6,4),eye,[-.1,.91,-.25]);cadd(new THREE.SphereGeometry(.055,6,4),eye,[.1,.91,-.25]);
  cadd(new THREE.SphereGeometry(.2,7,5),belly,[0,.42,-.25],[.72,.7,.25]);creature.position.set(2,0,-2);

  function wsUrl() { return (location.protocol==="https:"?"wss://":"ws://")+location.host; }
  function connect() {
    try { ws = new WebSocket(wsUrl()); } catch(e) { connection.textContent="Connection error"; connection.className="offline"; return; }
    ws.onopen=()=>{connection.textContent="Connected to multiplayer server";connection.className="online";};
    ws.onmessage=(event)=>{
      let msg;try{msg=JSON.parse(event.data);}catch(_){return;}
      if(msg.type==="welcome"){
        myId=msg.id;
        (msg.players||[]).forEach(p=>{if(!players.has(p.id))createPlayer(p,p.id===myId);});
        if(!players.has(myId))createPlayer({id:myId,name:document.getElementById("name").value,x:0,z:2,yaw:0},true);
        const me=players.get(myId);if(me){me.mine=true;document.getElementById("myname").textContent=me.name;}
        say("Connected! Open this same website link on your friend's computer.");
      } else if(msg.type==="player-joined"){if(msg.player&&!players.has(msg.player.id)){createPlayer(msg.player,false);say(msg.player.name+" joined the meadow.");}}
      else if(msg.type==="player-left"){removePlayer(msg.id);say("A player left the meadow.");}
      else if(msg.type==="player-moved"||msg.type==="player-updated"||msg.type==="you-updated"){
        const p=msg.player;if(!p)return;
        if(!players.has(p.id))createPlayer(p,p.id===myId);
        const entry=players.get(p.id);entry.name=p.name;entry.targetX=p.x;entry.targetZ=p.z;entry.targetYaw=p.yaw;
        if(msg.type!=="player-moved"){entry.avatar.children.forEach(ch=>{if(ch.isSprite){entry.avatar.remove(ch);}});entry.avatar.add(makeLabel(p.name));}
        if(p.id===myId)document.getElementById("myname").textContent=p.name;
      }
      countEl.textContent=players.size;
    };
    ws.onclose=()=>{connection.textContent="Disconnected — refresh to reconnect";connection.className="offline";};
    ws.onerror=()=>{connection.textContent="Server connection failed";connection.className="offline";};
  }
  document.getElementById("saveName").onclick=()=>{
    const name=document.getElementById("name").value.trim().slice(0,16)||"Explorer";
    document.getElementById("name").value=name;
    if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"set-name",name}));
  };
  document.addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
    if(e.code==="KeyE"){const me=players.get(myId);if(me&&Math.hypot(me.avatar.position.x-creature.position.x,me.avatar.position.z-creature.position.z)<3.2){if(!befriended){befriended=true;document.getElementById("companion").textContent="Lumi";say("Lumi trusts you now!");}else say("Lumi: Let's explore!");}else say("Walk closer to the golden creature first.");}
  });
  document.addEventListener("keyup",e=>keys[e.code]=false);
  document.addEventListener("mousemove",e=>{if(locked){yaw-=e.movementX*.0025;pitch=Math.max(-.2,Math.min(.65,pitch+e.movementY*.0018));}});
  document.addEventListener("click",()=>{if(document.pointerLockElement!==renderer.domElement&&renderer.domElement.requestPointerLock)renderer.domElement.requestPointerLock();});
  document.addEventListener("pointerlockchange",()=>locked=document.pointerLockElement===renderer.domElement);
  addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  const clock=new THREE.Clock();
  function update(){
    requestAnimationFrame(update);const dt=Math.min(clock.getDelta(),.04);const me=players.get(myId);
    if(me){
      const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),move=new THREE.Vector3();
      if(keys.KeyW||keys.ArrowUp)move.add(forward);if(keys.KeyS||keys.ArrowDown)move.sub(forward);if(keys.KeyD||keys.ArrowRight)move.add(right);if(keys.KeyA||keys.ArrowLeft)move.sub(right);
      if(move.lengthSq()>0){move.normalize();const speed=(keys.ShiftLeft||keys.ShiftRight)?2.2:4.2;me.avatar.position.addScaledVector(move,speed*dt);me.avatar.position.x=Math.max(-28,Math.min(28,me.avatar.position.x));me.avatar.position.z=Math.max(-32,Math.min(28,me.avatar.position.z));me.avatar.rotation.y=Math.atan2(-move.x,-move.z);me.yaw=me.avatar.rotation.y;}
      const focus=new THREE.Vector3(me.avatar.position.x,1.15,me.avatar.position.z);
      camera.position.set(focus.x+Math.sin(yaw)*7.5,focus.y+2.3+pitch*4,focus.z+Math.cos(yaw)*7.5);camera.lookAt(focus);
      if(ws&&ws.readyState===WebSocket.OPEN&&performance.now()-lastSent>80){lastSent=performance.now();ws.send(JSON.stringify({type:"move",x:me.avatar.position.x,z:me.avatar.position.z,yaw:me.avatar.rotation.y}));}
      if(befriended){const target=new THREE.Vector3(me.avatar.position.x+Math.sin(yaw)*1.25,0,me.avatar.position.z+Math.cos(yaw)*1.25);creature.position.lerp(target,Math.min(1,dt*4));}
    }
    players.forEach(p=>{if(!p.mine){p.avatar.position.x+=(p.targetX-p.avatar.position.x)*Math.min(1,dt*10);p.avatar.position.z+=(p.targetZ-p.avatar.position.z)*Math.min(1,dt*10);p.avatar.rotation.y=p.targetYaw;}});
    if(noticeTime>0){noticeTime-=dt;if(noticeTime<=0)notice.style.display="none";}
    renderer.render(scene,camera);
  }
  loading.style.display="none";connect();update();
})(); 
