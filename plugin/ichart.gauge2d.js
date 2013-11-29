/**
 * @overview the ichartjs Plug-in,the circular gauge component
 * @component#@chart#iChart.Gauge2D
 * @extend#iChart.Chart
 */
iChart.Gauge2D = iChart.extend(iChart.Chart, {
	/**
	 * initialize the context for the Gauge2D
	 */
	configure : function(config) {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Gauge2D.superclass.configure.call(this);
		
		this.type = 'gauge2d';
		this.dataType = 'single';
		
		this.set({
			/**
			 * @cfg {Float/String} Specifies the gauge's radius.If given a percentage,it will relative to minDistance.(default to '100%')
			 */
			radius : '100%',
			/**
			 * @cfg {Float} Specifies the gauge's initialized value.If not given,it will the same as tickmarks.lower.(default to null)
			 */
			value : null,
			panel:{
				background_color:'#FEFEFE',
				gradient:true,
				gradient_mode:'RadialGradientOutIn',
				border:{
					color:'#dedede',
					width:0
				},
				iborder:{
					radius:'95%',
					color:'#d8d8da',
					width:10
				}
			},
			tickmarks:{
				start_angle:30,
				/**
				 * @cfg {Float} Specifies the gauge's end angle.(default to null)
				 */
				end_angle:null,
				space_angle:4,
				radius:'88%',
				width:10,
				bg_color:null,
				size:2,
				count:5,
				color:'#344352',
				lower : 0,
				upper : 100,
				small_color:'#344352',
				small_count:5,
				/**
				 * [[0, 80, 'green'],[80, 90 'yellow'],[90, 100, 'red']]
				 */
				ranges:[]
			},
			label:{
				fontsize:11,
				/**
				 * @cfg {Number} the distance of column's bottom and text(default to 12)
				 */
				label_space : 12
			},
			/**
			 * @cfg {Object/String} Specifies the config of Top Text details see <link>iChart.Text</link>,If given a string,it will only apply the text.note:If the text is empty,then will not display
			 */
			text : {
				text:'',
				line_height:24,
				fontweight : 'bold',
				/**
				 * Specifies the font-size in pixels of top text.(default to 18)
				 */
				fontsize : 18
			},
			screen:{
				/**
				 * @cfg {Number} Specifies the number of decimal.(default to 0)
				 */
				decimalsnum : 1,
				unit_pre:'',
				unit_post:'',
				background_color:'#fefefe',
				height:22,
				width:60,
				fontsize:13,
				fontweight:600,
				border : {
					enable : true
				}
			},
			needle:{
				radius:'94%',
				size:4,
				color:'red',
				alpham:0.9,
				border:{
				  enable:true,
				  width:1,
				  color:'#bcbcbc'
				}
			},
			cap:{
				size:10,
				color:'#7bbfec',
				border:{
				  enable:true,
				  width:1,
				  color:'#bcbcbc'
				}
			},
            animation:true,
            animation_duration:500,
            animation_timing_function : 'easeOut'
		});
		
		this.registerEvent(
				/**
				 * @event Fires when value changed
				 * @paramter <link>iChart.Gauge2D</link>#g
				 * @paramter int#value
				 */
				'change');
		
		this.push('data',[0]);
	},
	doAnimation : function(t, d,_) {
		var v = _.animationArithmetic(t,_.needle.start, _.needle.offset, d);
		_.panel.draw();
		_.tickmark.draw();
		_.screen.push('text',v);
		_.screen.draw();
		if(_.text)
		_.text.draw();
		_.needle.push('value',v);
		_.needle.draw();
	},
	/**
	 * @method setting the vaule of gauge,the value must between the valid range
	 * @paramter int#value the vaule of gauge
	 * @return void
	 */
	to:function(v){
		var _ = this._();
		if(v==_.needle.value)return;
		if(_.processAnimation){
			_.needle.start = _.needle.get('value');
		}else{
			_.needle.start = _.needle.value;
		}
		_.needle.value = parseFloat(v);
		_.needle.offset = _.needle.value-_.needle.start;
		_.Animationed = false;
		_.screen.push('text',v);
		_.needle.push('value',v);
		_.draw();
		_.fireEvent(_, 'change', [_,v]);
	},
	doConfig : function() {
		iChart.Gauge2D.superclass.doConfig.call(this);
		var _ = this._(),pi=Math.PI,pi2=pi*2,f = Math.floor(_.get('minDistance') * 0.5),r = iChart.parsePercent(_.get('radius'),f);
		/**
		 * disable tip and legend
		 */
		_.push('tip',false);
		_.push('legend',false);
		
		_.originXY(_,[r + _.get('l_originx'),_.get('r_originx') - r,_.get('centerx')],[_.get('centery')]);
		
		/**
		 * build dial panel
		 */
		_.panel = new iChart.Custom(iChart.apply(_.get('panel'),{
			z_index:_.get('z_index')-10,
			radius:r,
			shadow:_.get('shadow'),
			originx:_.x,
			originy:_.y,
			configFn:function(_){
				_.r = _.get('radius');
				_.applyGradient(_.x-_.r,_.y-_.r,2*_.r*0.9,2*_.r*0.9);
				_.ir = iChart.parsePercent(_.get('iborder.radius'),_.r);
				_.iborder = _.get('iborder.width')>0;
			},
			drawFn:function(_){
				_.T.sector(_.x, _.y, _.r, 0, 0, pi2, _.get('f_color'), _.get('border.width'), _.get('border.width'), _.get('border.color'), _.get('shadow'), false, true);
				
				if(_.iborder){
					_.T.sector(_.x, _.y, _.ir, 0, 0, pi2, 0, true, _.get('iborder.width'), _.get('iborder.color'),_.get('iborder.shadow'), false, true, true);
				}
			}
		}), _);
		
		/**
		 * build tickmark
		 */
		_.tickmark = new iChart.Custom(iChart.apply(_.get('tickmarks'),{
			z_index:_.get('z_index')-9,
			originx:_.x,
			originy:_.y,
			label:_.get('label'),
			configFn:function(_){
				_.r = iChart.parsePercent(_.get('radius'),r);
				_.tickbg = [];
				_.tickmarks = [];
				_.labels = [];
				_.pushIf('end_angle',-_.get('start_angle'));
				var count= _.push('count',iChart.lowTo(2,_.get('count'))),
					A = _.push('space_angle',iChart.angle2Radian(_.get('space_angle')/2)),
					sA = _.push('start_angle',iChart.angle2Radian(_.get('start_angle')+ 90))+A,
					eA = _.push('end_angle',iChart.angle2Radian(_.get('end_angle')+ 450))-A,
					colors = [].concat(_.get('bg_color')),
					tcolors = [].concat(_.get('color')),
					stcolors = [].concat(_.get('small_color')),
					scount = _.get('small_count')||1,
					l = _.get('lower'),
					u = _.get('upper'),
					ranges = _.get('ranges'),
					T = (u - l)/count,
					tA = eA- sA,
					S = tA/count,
					AA = S/scount,
					size = _.get('size'),
					w = _.get('width')-1,
					tr = _.r - w -_.get('label.label_space'),
					wA = size/2/_.r,
					sAA,
					swA = wA*0.6;
				
				_.minMarks = T/scount;
				_.lower =l;
				_.upper =u;
				_.sA =sA;
				_.eA =eA;
				_.tA =tA;
				
				_.getRadian = function(v){
					return Math.abs(((iChart.between(_.lower,_.upper,v)-_.lower)/(_.upper-_.lower))*_.tA)+_.sA;
				}
				
				for(var i=0;i<=count;i++){
					tcolors[i] = tcolors[i] || tcolors[i-1];
					stcolors[i] = stcolors[i] || stcolors[i-1];
					
					_.tickmarks.push({
						start:sA-wA,
						end:sA+wA,
						radius:_.r-1,
						width:w,
						color:tcolors[i]
					});
					
					(i<count)&&colors[i]&&_.tickbg.push({
						start:sA-(i==0?A:0),
						end:sA+S+(count-i==1?A:0),
						color:colors[i]
					});
					
					sAA = sA;
					for(var j=0;i<count&&j<scount-1;j++){
						sAA+=AA;
						_.tickmarks.push({
							start:sAA-swA,
							end:sAA+swA,
							radius:_.r-1-w*0.4,
							width:w*0.6,
							color:stcolors[i]
						});
					}
					
					_.labels.push(new iChart.Text(iChart.apply(_.get('label'),{
						text : l,
						textAlign:'center',
						textBaseline:'middle',
						originx : _.x+Math.cos(sA)*tr,
						originy : _.y+Math.sin(sA)*tr
					}), _));
					
					l+=T;
					sA+=S;
				}
				/**
				 * customize ranges
				 */
				ranges.each(function(r){
					_.tickbg.push({
						start:_.getRadian(r[0]),
						end:_.getRadian(r[1]),
						color:r[2]
					});
				});
			},
			drawFn:function(_){
				_.tickbg.each(function(bg){
					_.T.sector(_.x, _.y, _.r,_.get('width'),bg.start, bg.end,bg.color, 0, 0, 0, 0, false, true, true);
				});
				
				_.tickmarks.each(function(tick){
					_.T.sector(_.x, _.y, tick.radius,tick.width,tick.start,tick.end,tick.color, 0, 0, 0, 0, false, true, true);
				});
				
				_.labels.each(function(label){
					label.draw();
				});
			}
		}), _);
		
		var value = (!_.get('value')&&_.get('value')!=0)?_.tickmark.lower:_.get('value');
		
		/**
		 * build screen
		 */
		_.screen = new iChart.Text(iChart.apply(_.get('screen'),{
			z_index:_.get('z_index')-8,
			originx:_.x-_.get('screen.width')/2,
			originy:_.y+r/3,
			text:value
		}), _);
		
		_.screen.on('beforedraw', function() {
			this.push('text',this.get('unit_pre')+parseFloat(this.get('text')).toFixed(this.get('decimalsnum'))+this.get('unit_post'));
			return true;
		});
		
		if (iChart.isString(_.get('text'))) {
			_.push('text', iChart.applyIf({
				text : _.get('text')
			}, _.default_.text));
		}
		
		if (_.get('text.text') != '') {
			_.text = new iChart.Text(iChart.apply(_.get('text'),{
				z_index:_.get('z_index')-8,
				originx:_.x,
				originy:_.y-r/3,
				textBaseline:'middle'
			}), _);
			_.components.push(_.text);
		}
		/**
		 * build needle
		 */
		_.needle = new iChart.Custom({
			z_index:_.get('z_index')-6,
			needle:_.get('needle'),
			cap:_.get('cap'),
			radius:iChart.parsePercent(_.get('needle.radius'),_.tickmark.r - _.get('tickmarks.width')*0.5),
			originx:_.x,
			originy:_.y,
			tickmark:_.tickmark,
			value:value,
			configFn:function(_){
				_.tickmark = _.get('tickmark');
				_.r = iChart.parsePercent(_.get('needle.radius'),_.tickmark.r - _.tickmark.get('width')*0.5);
				_.value = _.get('value');
				_.start = _.tickmark.lower;
				/**
				 * offset from start to value
				 */
				_.offset = _.value - _.start;
			},
			drawFn:function(_){
				var A = _.tickmark.getRadian(_.get('value')),cap = _.get('cap.size'),Q = _.get('needle.size')/cap;
				_.T.polygon(_.get('needle.color'),_.get('needle.border.enable'),_.get('needle.border.width'),_.get('needle.border.color'),_.get('needle.shadow'),_.get('needle.alpham')||1,[{x:_.x+Math.cos(A-Q)*cap,y:_.y+Math.sin(A-Q)*cap},{x:_.x+Math.cos(A+Q)*cap,y:_.y+Math.sin(A+Q)*cap},{x:_.x+Math.cos(A)*_.r,y:_.y+Math.sin(A)*_.r}]);
				_.T.sector(_.x, _.y,cap, 0, 0, pi2, _.get('cap.color'),_.get('cap.border.enable'),_.get('cap.border.width'),_.get('cap.border.color'),_.get('needle.shadow'), false, true);
			}
		}, _);
		
		_.components.push(_.screen,_.panel,_.tickmark,_.needle);
	}

});
/**
 * @end
 */