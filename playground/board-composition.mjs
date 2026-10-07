export function createBoardComposition(logoSpec) {
  const logoItems=logoSpec.items.map(item=>({...item,position:{x:1120,y:5}}));
  const lineSpec={type:'line',renderer:'svg',width:320,height:190,data:[{name:'Jan',value:30},{name:'Feb',value:48},{name:'Mar',value:42},{name:'Apr',value:72}],encoding:{x:{field:'name'},y:{field:'value'}},title:{text:'Trend'},branding:{enabled:false}};
  const barSpec={type:'bar',renderer:'svg',width:320,height:190,data:[{name:'North',value:64},{name:'South',value:46},{name:'West',value:80}],encoding:{x:{field:'name'},y:{field:'value'}},title:{text:'Regions'},branding:{enabled:false}};
  const areaSpec={type:'area',renderer:'svg',width:670,height:190,data:[{name:'Q1',value:38},{name:'Q2',value:58},{name:'Q3',value:52},{name:'Q4',value:84}],encoding:{x:{field:'name'},y:{field:'value'}},title:{text:'Delivery signals'},branding:{enabled:false}};
  const spec={width:1280,height:720,renderer:'svg',background:'#f8fbff',grid:{visible:true,size:24,variant:'dots',color:'#d9e5f2'},assets:[],items:[
    {id:'title',kind:'text',text:'Agent-ready visual composition',position:{x:48,y:42},size:{width:680,height:44},fontSize:28,style:{fill:'#102a43'}},
    {id:'subtitle',kind:'text',text:'Charts + freeform scene graph + safe export',position:{x:50,y:82},size:{width:600,height:24},fontSize:15,style:{fill:'#627d98'}},
    {id:'charts-card',kind:'shape',shape:'rectangle',position:{x:32,y:126},size:{width:720,height:548},style:{fill:'#ffffff',stroke:'#d9e5f2',strokeWidth:1}},
    {id:'art-card',kind:'shape',shape:'rectangle',position:{x:780,y:126},size:{width:468,height:548},style:{fill:'#fffaf2',stroke:'#f3d6a4',strokeWidth:1}},
    {id:'charts-title',kind:'text',text:'Chart composition',position:{x:56,y:154},size:{width:240,height:24},fontSize:17,style:{fill:'#243b53'}},
    {id:'art-title',kind:'text',text:'Freeform scene',position:{x:808,y:154},size:{width:220,height:24},fontSize:17,style:{fill:'#7b341e'}},
    {id:'line',kind:'chart',position:{x:56,y:184},size:{width:320,height:190},spec:lineSpec},
    {id:'bar',kind:'chart',position:{x:408,y:184},size:{width:320,height:190},spec:barSpec},
    {id:'area',kind:'chart',position:{x:56,y:418},size:{width:672,height:190},spec:areaSpec},
    {id:'arc-card',kind:'shape',shape:'rectangle',position:{x:804,y:190},size:{width:124,height:116},style:{fill:'#f8fbff',stroke:'#dbeafe',strokeWidth:1}},
    {id:'sector-card',kind:'shape',shape:'rectangle',position:{x:944,y:190},size:{width:124,height:116},style:{fill:'#f8fbff',stroke:'#dbeafe',strokeWidth:1}},
    {id:'curve-card',kind:'shape',shape:'rectangle',position:{x:1084,y:190},size:{width:140,height:116},style:{fill:'#fff7ed',stroke:'#fed7aa',strokeWidth:1}},
    {id:'arc-demo',kind:'shape',shape:'arc',position:{x:838,y:204},size:{width:56,height:56},startAngle:210,endAngle:330,style:{fill:'none',stroke:'#2563eb',strokeWidth:4}},
    {id:'sector-demo',kind:'shape',shape:'sector',position:{x:978,y:204},size:{width:56,height:56},startAngle:210,endAngle:330,innerRadius:.35,style:{fill:'#60a5fa',stroke:'#1d4ed8',strokeWidth:2}},
    {id:'curve-demo',kind:'path',curve:'cubic',points:[{x:0,y:.5},{x:.25,y:0},{x:.75,y:1},{x:1,y:.5}],position:{x:1098,y:218},size:{width:112,height:40},style:{fill:'none',stroke:'#f97316',strokeWidth:4}},
    {id:'arc-label',kind:'text',text:'Arc',position:{x:804,y:274},size:{width:124,height:20},fontSize:13,textAlign:'center',verticalAlign:'middle',style:{fill:'#1e3a8a'}},
    {id:'sector-label',kind:'text',text:'Sector',position:{x:944,y:274},size:{width:124,height:20},fontSize:13,textAlign:'center',verticalAlign:'middle',style:{fill:'#1e3a8a'}},
    {id:'curve-label',kind:'text',text:'Cubic Bezier',position:{x:1084,y:274},size:{width:140,height:20},fontSize:13,textAlign:'center',verticalAlign:'middle',style:{fill:'#9a3412'}},
    {id:'animal-body',kind:'shape',shape:'ellipse',position:{x:963,y:478},size:{width:108,height:126},style:{fill:'#f59e0b',stroke:'#b45309',strokeWidth:3}},
    {id:'animal-face',kind:'shape',shape:'ellipse',position:{x:930,y:342},size:{width:178,height:154},style:{fill:'#fbbf24',stroke:'#b45309',strokeWidth:3}},
    {id:'ear-left',kind:'shape',shape:'diamond',position:{x:932,y:314},size:{width:58,height:72},style:{fill:'#fb923c',stroke:'#b45309',strokeWidth:3}},
    {id:'ear-right',kind:'shape',shape:'diamond',position:{x:1048,y:314},size:{width:58,height:72},style:{fill:'#fb923c',stroke:'#b45309',strokeWidth:3}},
    {id:'eye-left',kind:'shape',shape:'ellipse',position:{x:970,y:390},size:{width:18,height:24},style:{fill:'#102a43'}},
    {id:'eye-right',kind:'shape',shape:'ellipse',position:{x:1050,y:390},size:{width:18,height:24},style:{fill:'#102a43'}},
    {id:'nose',kind:'shape',shape:'diamond',position:{x:1002,y:430},size:{width:32,height:24},style:{fill:'#7b341e',stroke:'#5b2118',strokeWidth:2}},
    {id:'animal-caption',kind:'text',text:'compose freely',position:{x:954,y:626},size:{width:126,height:24},fontSize:15,textAlign:'center',verticalAlign:'middle',style:{fill:'#9a3412'}},
    ...logoItems.map(item=>({...item,style:{...item.style,stroke:'#ffffff',strokeWidth:2.5}}))
  ]};
  return spec;
}
