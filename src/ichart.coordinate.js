/**
 * @overview this is inner use for axis
 * @component#iChart.Scale
 * @extend#iChart.Component
 */
iChart.Scale = iChart.extend(iChart.Component, {
	configure : function() {

		/**
		 * invoked the super class's configuration
		 */
		iChart.Scale.superclass.configure.apply(this, arguments);

		/**
		 * indicate the component's type
		 */
		this.type = 'scale';

		this.set({
			/**
			 * @cfg {String} Specifies alignment of this scale.(default to 'left')
			 */
			position : 'left',
			/**
			 * @cfg {String} the axis's type(default to 'h') Available value are:
			 * @Option 'h' :horizontal
			 * @Option 'v' :vertical
			 */
			which : 'h',
			/**
			 * @cfg {Number} Specifies value of Baseline Coordinate.(default to 0)
			 */
			basic_value:0,
			/**
			 * @cfg {Boolean} indicate whether the grid is accord with scale.(default to true)
			 */
			scale2grid : true,
			/**
			 * @inner {Number}
			 */
			distance : undefined,
			/**
			 * @cfg {Number} Specifies the start coordinate scale value.(default to 0)
			 */
			start_scale : 0,
			/**
			 * @cfg {Number} Specifies the end coordinate scale value.Note either this or property of max_scale must be has the given value.(default to undefined)
			 */
			end_scale : undefined,
			/**
			 * @cfg {Number} Specifies the chart's minimal value
			 */
			min_scale : undefined,
			/**
			 * @cfg {Number} Specifies the chart's maximal value
			 */
			max_scale : undefined,
			/**
			 * @cfg {Number} Specifies the space of two scale.Note either this or property of scale_share must be has the given value.(default to undefined)
			 */
			scale_space : undefined,
			/**
			 * @cfg {Number} Specifies the number of scale on axis.(default to 5)
			 */
			scale_share : 5,
			/**
			 * @cfg {Boolean} True to display the scale line.(default to true)
			 */
			scale_enable : true,
			/**
			 * @cfg {Number} Specifies the size of brush(context.linewidth).(default to 1)
			 */
			scale_size : 1,
			/**
			 * @cfg {Number} Specifies the width(length) of scale.(default to 4)
			 */
			scale_width : 4,
			/**
			 * @cfg {String} Specifies the color of scale.(default to 4)
			 */
			scale_color : '#333333',
			/**
			 * @cfg {String} Specifies the align against axis.(default to 'center') When the property of which set to 'h',Available value are:
			 * @Option 'left'
			 * @Option 'center'
			 * @Option 'right' 
			 * When the property of which set to 'v', Available value are:
			 * @Option 'top'
			 * @Option 'center'
			 * @Option 'bottom'
			 */
			scaleAlign : 'center',
			/**
			 * @cfg {Array} the customize labels
			 */
			labels : [],
			/**
			 * @cfg {<link>iChart.Text</link>} Specifies label's option.
			 */
			label : {},
			/**
			 * @cfg {Number} Specifies the distance to scale.(default to 6)
			 */
			text_space : 6,
			/**
			 * @cfg {String} Specifies the align against axis.(default to 'left' or 'bottom' in v mode) When the property of which set to 'h',Available value are:
			 * @Option 'left'
			 * @Option 'right' When the property of which set to 'v', Available value are:
			 * @Option 'top'
			 * @Option 'bottom'
			 */
			textAlign : 'left',
			/**
			 * @cfg {Number} Specifies the number of decimal.this will change along with scale.(default to 0)
			 */
			decimalsnum : 0,
			/**
			 * @inner {String} the style of overlapping(default to 'none') Available value are:
			 * @Option 'square'
			 * @Option 'round'
			 * @Option 'none'
			 */
			join_style : 'none',
			/**
			 * @inner {Number}
			 */
			join_size : 2
		});

		this.registerEvent(
		/**
		 * @event Fires the event when parse text,you can return a object like this:{text:'',originx:100,originy:100} to override the given.
		 * @paramter string#text item's text
		 * @paramter int#originx coordinate-x of item's text
		 * @paramter int#originy coordinate-y of item's text
		 * @paramter int#index item's index
		 * @paramter boolean#last If last item
		 */
		'parseText');

	},
	isEventValid : function() {
		return {
			valid : false
		};
	},
	/**
	 * from left to right,top to bottom
	 */
	doDraw : function(_) {
		if (_.get('scale_enable'))
			_.items.each(function(item) {
				_.T.line(item.x0, item.y0, item.x1, item.y1, _.get('scale_size'), _.get('scale_color'), false);
			});
		_.labels.each(function(l) {
			l.draw();
		});
	},
	doLayout:function(x,y,_){
		if (_.get('scale_enable'))
			_.items.each(function(item) {
				item.x0+=x;
				item.y0+=y;
				item.x1+=x;
				item.y1+=y;
			});
		_.labels.each(function(l) {
			l.doLayout(x,y,0,l);
		});
	},
	doConfig : function() {
		iChart.Scale.superclass.doConfig.call(this);
		iChart.Assert.isNumber(this.get('distance'), 'distance');

		var _ = this._(),abs = Math.abs,customL = _.get('labels').length, min_s = _.get('min_scale'), max_s = _.get('max_scale'), s_space = _.get('scale_space'), e_scale = _.get('end_scale'), start_scale = _.get('start_scale');

		_.items = [];
		_.labels = [];
		_.number = 0;

		if (customL > 0) {
			_.number = customL - 1;
		} else {
			iChart.Assert.isTrue(iChart.isNumber(max_s) || iChart.isNumber(e_scale), 'max_scale&end_scale');
			/**
			 * end_scale must greater than maxScale
			 */
			if (!iChart.isNumber(e_scale) || e_scale < max_s) {
				e_scale = _.push('end_scale', iChart.ceil(max_s));
			}
			/**
			 * startScale must less than minScale
			 */
			if (start_scale > min_s) {
				start_scale = _.push('start_scale', iChart.floor(min_s));
			}
			
			
			if (s_space && abs(s_space) < abs(e_scale - start_scale)) {
				_.push('scale_share', (e_scale - start_scale) / s_space);
			}
			
			_.number = _.push('scale_share', abs(_.get('scale_share')));
			
			/**
			 * value of each scale
			 */
			if (!s_space || s_space >( e_scale - start_scale)) {
				s_space = _.push('scale', (e_scale - start_scale) / _.get('scale_share'));
			}
			
			if (parseInt(s_space)!=s_space && _.get('decimalsnum') == 0) {
				var dec = s_space+"";
				dec =  dec.substring(dec.indexOf('.')+1);
				_.push('decimalsnum', dec.length);
			}
		}
		
		/**
		 * the real distance of each scale
		 */
		_.push('distanceOne', _.get('valid_distance') / _.number);

		var text, x, y, x1 = 0, y1 = 0, x0 = 0, y0 = 0, tx = 0, ty = 0, w = _.get('scale_width'), w2 = w / 2, sa = _.get('scaleAlign'), ta = _.get('position'), ts = _.get('text_space'), tbl = '',aw = _.get('coo').get('axis.width');
		
		_.push('which', _.get('which').toLowerCase());
		_.isH = _.get('which') == 'h';
		if (_.isH) {
			if (sa == _.O) {
				y0 = -w;
			} else if (sa == _.C) {
				y0 = -w2;
				y1 = w2;
			} else {
				y1 = w;
			}

			if (ta == _.O) {
				ty = -ts-aw[0];
				tbl = _.B;
			} else {
				ty = ts+aw[2];
				tbl = _.O;
			}
			ta = _.C;
		} else {
			if (sa == _.L) {
				x0 = -w;
			} else if (sa == _.C) {
				x0 = -w2;
				x1 = w2;
			} else {
				x1 = w;
			}
			tbl = 'middle';
			if (ta == _.R) {
				ta = _.L;
				tx = ts+aw[1];
			} else {
				ta = _.R;
				tx = -ts-aw[3];
			}
		}
		/**
		 * valid width only applies when there is h,then valid_height only applies when there is v
		 */
		for ( var i = 0; i <= _.number; i++) {
			text = customL ? _.get('labels')[i] : (s_space * i + start_scale).toFixed(_.get('decimalsnum'));
			x = _.isH ? _.get('valid_x') + i * _.get('distanceOne') : _.x;
			y = _.isH ? _.y : _.get('valid_y') + _.get('distance') - i * _.get('distanceOne');

			_.items.push({
				x : x,
				y : y,
				x0 : x + x0,
				y0 : y + y0,
				x1 : x + x1,
				y1 : y + y1
			});

			/**
			 * put the label into a Text?
			 */
			_.labels.push(new iChart.Text(iChart.applyIf(iChart.apply(_.get('label'), iChart.merge({
				text : text,
				x : x,
				y : y,
				originx : x + tx,
				originy : y + ty
			}, _.fireEvent(_, 'parseText', [text, x + tx, y + ty, i, _.number == i]))), {
				textAlign : ta,
				textBaseline : tbl
			}), _));

			/**
			 * maxwidth = Math.max(maxwidth, _.T.measureText(text));
			 */
		}
	}
});

/**
 * @end
 */
iChart.Coordinate = {
	coordinate_ : function() {
		var _ = this._(),scale = _.get('coordinate.scale'),li=_.get('scaleAlign'),f=true;
		if(iChart.isObject(scale)){
			scale = [scale];
		}
		if(iChart.isArray(scale)){
			scale.each(function(s){
				if(s.position ==li){
					f  = false;
					return false;
				}
			});
			if(f){
				if(li==_.L){
					li = _.R;
				}else if(li==_.R){
					li = _.L;
				}else if(li==_.O){
					li = _.B;
				}else{
					li = _.O;
				}
				_.push('scaleAlign',li);
			}
			scale.each(function(s){
				if(s.position ==li){
					if(!s.start_scale)
						s.min_scale = _.get('minValue');
					if(!s.end_scale)
						s.max_scale = _.get('maxValue');
					return false;
				}
			});
		}else{
			_.push('coordinate.scale',{
				position : li,
				scaleAlign : li,
				max_scale : _.get('maxValue'),
				min_scale : _.get('minValue')
			});
		}
		
		if (_.is3D()) {
			_.push('coordinate.xAngle_', _.get('xAngle_'));
			_.push('coordinate.yAngle_', _.get('yAngle_'));
			/**
			 * the Coordinate' Z is same as long as the column's
			 */
			_.push('coordinate.zHeight', _.get('zHeight') * _.get('bottom_scale'));
		}
		
		return new iChart[_.is3D()?'Coordinate3D':'Coordinate2D'](_.get('coordinate'), _);
	},
	coordinate : function() {
		/**
		 * calculate chart's measurement
		 */
		var _ = this._(), f = 0.8, 
			_w = _.get('client_width'), 
			_h = _.get('client_height'), 
			w = _.push('coordinate.width',iChart.parsePercent(_.get('coordinate.width'),_w)), 
			h = _.push('coordinate.height',iChart.parsePercent(_.get('coordinate.height'),_h)), 
			vw = _.get('coordinate.valid_width'), 
			vh = _.get('coordinate.valid_height');
		
		if (!h || h > _h) {
			h = _.push('coordinate.height', Math.floor(_h * f));
		}
		
		if (!w || w > _w) {
			w = _.push('coordinate.width', Math.floor(_w * f));
		}
		
		vw = _.push('coordinate.valid_width',iChart.parsePercent(vw,w));
		vh = _.push('coordinate.valid_height',iChart.parsePercent(vh,h));
		
		if (_.is3D()) {
			var a = _.get('coordinate.pedestal_height');
			var b = _.get('coordinate.board_deep');
			a = iChart.isNumber(a)?a:22;
			b = iChart.isNumber(b)?b:20;
			h = _.push('coordinate.height', h - a - b);
		}
		
		/**
		 * calculate chart's alignment
		 */
		if (_.get('align') == _.L) {
			_.push(_.X, _.get('l_originx'));
		} else if (_.get('align') == _.R) {
			_.push(_.X, _.get('r_originx') - w);
		} else {
			_.push(_.X, _.get('centerx') - w / 2);
		}

		_.x = _.push(_.X, _.get(_.X) + _.get('offsetx'));
		_.y = _.push(_.Y, _.get('centery') - h / 2 + _.get('offsety'));
		
		if (!vw || vw > w) {
			_.push('coordinate.valid_width', w);
		}
		
		if (!vh || vh > h) {
			_.push('coordinate.valid_height', h);
		}
		
		_.push('coordinate.originx', _.x);
		_.push('coordinate.originy', _.y);
		
	}
}
/**
 * @overview this component use for abc
 * @component#iChart.Coordinate2D
 * @extend#iChart.Component
 */
iChart.Coordinate2D = iChart.extend(iChart.Component, {
	configure : function() {
		/**
		 * invoked the super class's configurationuration
		 */
		iChart.Coordinate2D.superclass.configure.apply(this, arguments);

		/**
		 * indicate the component's type
		 */
		this.type = 'coordinate2d';

		this.set({
			/**
			 * @inner {Number}
			 */
			sign_size : 12,
			/**
			 * @inner {Number}
			 */
			sign_space : 5,
			/**
			 * @cfg {Array} the option for scale.For details see <link>iChart.Scale</link>
			 */
			scale : [],
			/**
			 * @cfg {String/Number} Here,specify as '80%' relative to client width.(default to '80%')
			 */
			width:'80%',
			/**
			 * @cfg {String/Number} Here,specify as '80%' relative to client height.(default to '80%')
			 */
			height:'80%',
			/**
			 * @cfg {String/Number} Specifies the valid width,less than the width of coordinate.you can applies a percent value relative to width.(default to '100%')
			 */
			valid_width : '100%',
			/**
			 * @cfg {String/Number} Specifies the valid height,less than the height of coordinate.you can applies a percent value relative to width.(default to '100%')
			 */
			valid_height : '100%',
			/**
			 * @cfg {Number} Specifies the linewidth of the grid.(default to 1)
			 */
			grid_line_width : 1,
			/**
			 * @cfg {String} Specifies the color of the grid.(default to '#dbe1e1')
			 */
			grid_color : '#dbe1e1',
			/**
			 * @cfg {Object} Specifies the stlye of horizontal grid.(default to empty object).Available property are:
			 * @Option solid {Boolean} True to draw a solid line.else draw a dotted line.(default to true)
			 * @Option size {Number} Specifies size of line segment when solid is false.(default to 10)
			 * @Option fator {Number} Specifies the times to size(default to 1)
			 * @Option width {Number} Specifies the width of grid line.(default to 1)
			 * @Option color {String} Specifies the color of grid line.(default to '#dbe1e1')
			 */
			gridHStyle : {},
			/**
			 * @cfg {Object} Specifies the stlye of horizontal grid.(default to empty object).Available property are:
			 * @Option solid {Boolean} True to draw a solid line.else draw a dotted line.(default to true)
			 * @Option size {Number} Specifies size of line segment when solid is false.(default to 10)
			 * @Option fator {Number} Specifies the times to size(default to 1)
			 * @Option width {Number} Specifies the width of grid line.(default to 1)
			 * @Option color {String} Specifies the color of grid line.(default to '#dbe1e1')
			 */
			gridVStyle : {},
			/**
			 * @cfg {Boolean} True to display grid line.(default to true)
			 */
			gridlinesVisible : true,
			/**
			 * @cfg {Boolean} indicate whether the grid is accord with scale,on the premise of grids is not specify. this just give a convenient way bulid grid for default.and actual value depend on scale's scale2grid
			 */
			scale2grid : true,
			/**
			 * @cfg {Object} this is grid config for custom.there has two valid property horizontal and vertical.the property's sub property is: way:the manner calculate grid-line (default to 'share_alike') Available property are:
			 * @Option share_alike
			 * @Option given_value value: when property way apply to 'share_alike' this property mean to the number of grid's line.
			 *  when apply to 'given_value' this property mean to the distance each grid line(unit:pixel) . 
			 *  code will like: 
			 *  { 
			 *   horizontal: {way:'share_alike',value:10},
			 *   vertical: { way:'given_value', value:40 }
			 *   }
			 */
			grids : undefined,
			/**
			 * @cfg {Boolean} If True the grid line will be ignored when gird and axis overlap.(default to true)
			 */
			ignoreOverlap : true,
			/**
			 * @cfg {Boolean} If True the grid line will be ignored when gird and coordinate's edge overlap.(default to false)
			 */
			ignoreEdge : false,
			/**
			 * @inner {String} Specifies the label on x-axis
			 */
			xlabel : '',
			/**
			 * @inner {String} Specifies the label on y-axis
			 */
			ylabel : '',
			/**
			 * @cfg {String} Here,specify as false to make background transparent.(default to null)
			 */
			background_color : 0,
			/**
			 * @cfg {Boolean} True to stripe the axis.(default to true)
			 */
			striped : true,
			/**
			 * @cfg {String} Specifies the direction apply striped color.(default to 'v')Available value are:
			 * @Option 'h' horizontal
			 * @Option 'v' vertical
			 */
			striped_direction : 'v',
			/**
			 * @cfg {float(0.01 - 0.5)} Specifies the factor make color dark striped,relative to background-color,the bigger the value you set,the larger the color changed.(defaults to '0.01')
			 */
			striped_factor : 0.01,
			/**
			 * @cfg {Object} Specifies config crosshair.(default enable to false).For details see <link>iChart.CrossHair</link> Note:this has a extra property named 'enable',indicate whether crosshair available(default to false)
			 */
			crosshair : {
				enable : false
			},
			/**
			 * @cfg {Number} Required,Specifies the width of this coordinate.(default to undefined)
			 */
			width : undefined,
			/**
			 * @cfg {Number} Required,Specifies the height of this coordinate.(default to undefined)
			 */
			height : undefined,
			/**
			 * @cfg {Number}Override the default as -1 to make sure it at the bottom.(default to -1)
			 */
			z_index : -1,
			/**
			 * @cfg {Object} Specifies style for axis of this coordinate. Available property are:
			 * @Option enable {Boolean} True to display the axis.(default to true)
			 * @Option color {String} Specifies the color of each axis.(default to '#666666')
			 * @Option width {Number/Array} Specifies the width of each axis, If given the a array,there must be have have 4 element, like this:[1,0,0,1](top-right-bottom-left).(default to 1)
			 */
			axis : {
				enable : true,
				color : '#666666',
				width : 1
			}
		});
		
		this.scale = [];
		this.gridlines = [];
	},
	getScale : function(p) {
		for ( var i = 0; i < this.scale.length; i++) {
			var k = this.scale[i];
			if (k.get('position') == p) {
				var u = [k.get('basic_value'),k.get('start_scale'),k.get('end_scale'),k.get('end_scale') - k.get('start_scale'),0];
				u[4] = iChart.inRange(u[1],u[2]+1,u[0])||iChart.inRange(u[2]-1,u[1],u[0]);
				return {
					range:u[4],
					basic:u[4]?(u[0]-u[1]) / u[3]:0,
					start : u[4]?u[0]:u[1],
					end : u[2],
					distance : u[3]
				};
			}
		}
		return {
			start : 0,
			end : 0,
			distance : 0
		};
	},
	isEventValid : function(e,_) {
		return {
			valid : e.x > _.x && e.x < (_.x + _.get(_.W)) && e.y < _.y + _.get(_.H) && e.y > _.y
		};
	},
	doDraw : function(_) {
		_.T.box(_.x, _.y, _.get(_.W), _.get(_.H), 0, _.get('f_color'));
		if (_.get('striped')) {
			var x, y, f = false, axis = _.get('axis.width'), c = iChart.dark(_.get('background_color'), _.get('striped_factor'),0);
		}
		var v = (_.get('striped_direction') == 'v');
		_.gridlines.each(function(g,i) {
			if (_.get('striped')) {
				if (f) {
					if (v)
						_.T.box(g.x1, g.y1 + g.width, g.x2 - g.x1, y - g.y1 - g.width, 0, c);
					else
						_.T.box(x + g.width, g.y2, g.x1 - x, g.y1 - g.y2, 0, c);
				}
				x = g.x1;
				y = g.y1;
				f = !f;
			}
		}).each(function(g) {
			if(!g.overlap){
				if(g.solid){
					_.T.line(g.x1, g.y1, g.x2, g.y2, g.width, g.color);
				}else{
					_.T.dotted(g.x1, g.y1, g.x2, g.y2, g.width, g.color,g.size,g.fator);
				}
			}
		});
		_.T.box(_.x, _.y, _.get(_.W), _.get(_.H), _.get('axis'), false, _.get('shadow'),true);
		_.scale.each(function(s) {
			s.draw()
		});
	},
	doConfig : function() {
		iChart.Coordinate2D.superclass.doConfig.call(this);

		var _ = this._();

		iChart.Assert.isNumber(_.get(_.W), _.W);
		iChart.Assert.isNumber(_.get(_.H), _.H);

		/**
		 * this element not atomic because it is a container,so this is a particular case.
		 */
		_.atomic = false;

		/**
		 * apply the gradient color to f_color
		 */
		if (_.get('gradient') && iChart.isString(_.get('f_color'))) {
			_.push('f_color', _.T.avgLinearGradient(_.x, _.y, _.x, _.y + _.get(_.H), [_.get('dark_color'), _.get('light_color')]));
		}
		
		if (_.get('axis.enable')) {
			var aw = _.get('axis.width');
			if (!iChart.isArray(aw))
				_.push('axis.width', [aw, aw, aw, aw]);
		}else{
			_.push('axis.width', [0, 0, 0, 0]);
		}

		if (_.get('crosshair.enable')) {
			_.push('crosshair.wrap', _.container.shell);
			_.push('crosshair.height', _.get(_.H));
			_.push('crosshair.width', _.get(_.W));
			_.push('crosshair.top', _.y);
			_.push('crosshair.left', _.x);

			_.crosshair = new iChart.CrossHair(_.get('crosshair'), _);
		}

		var jp, cg = !!(_.get('gridlinesVisible') && _.get('grids')), hg = cg && !!_.get('grids.horizontal'), vg = cg && !!_.get('grids.vertical'), h = _.get(_.H), w = _.get(_.W), vw = _.get('valid_width'), vh = _.get('valid_height'), k2g = _.get('gridlinesVisible')
				&& _.get('scale2grid') && !(hg && vg), sw = (w - vw) / 2, sh = (h - vh) / 2, axis = _.get('axis.width');
		
		_.push('x_start', _.x+(w - vw) / 2);
		_.push('x_end', _.x + (w + vw) / 2);
		_.push('y_start', _.y+(h - vh) / 2);
		_.push('y_end', _.y + (h + vh) / 2);
		
		if (!iChart.isArray(_.get('scale'))) {
			if (iChart.isObject(_.get('scale')))
				_.push('scale', [_.get('scale')]);
			else
				_.push('scale', []);
		}
		
		_.get('scale').each(function(kd, i) {
			jp = kd['position'];
			jp = jp || _.L;
			jp = jp.toLowerCase();
			kd[_.X] = _.x;
			kd['coo'] = _;
			kd[_.Y] = _.y;
			kd['valid_x'] = _.x + sw;
			kd['valid_y'] = _.y + sh;
			kd['position'] = jp;
			/**
			 * calculate coordinate,direction,distance
			 */
			if (jp == _.O) {
				kd['which'] = 'h';
				kd['distance'] = w;
				kd['valid_distance'] = vw;
			} else if (jp == _.R) {
				kd['which'] = 'v';
				kd['distance'] = h;
				kd['valid_distance'] = vh;
				kd[_.X] += w;
				kd['valid_x'] += vw;
			} else if (jp == _.B) {
				kd['which'] = 'h';
				kd['distance'] = w;
				kd['valid_distance'] = vw;
				kd[_.Y] += h;
				kd['valid_y'] += vh;
			} else {
				kd['which'] = 'v';
				kd['distance'] = h;
				kd['valid_distance'] = vh;
			}
			_.scale.push(new iChart.Scale(kd, _.container));
		}, _);

		var iol = _.push('ignoreOverlap', _.get('ignoreOverlap') && _.get('axis.enable') || _.get('ignoreEdge'));

		if (iol) {
			if (_.get('ignoreEdge')) {
				var ignoreOverlap = function(w, x, y) {
					return w == 'v' ? (y == _.y) || (y == _.y + h) : (x == _.x) || (x == _.x + w);
				}
			} else {
				var ignoreOverlap = function(wh, x, y) {
					return wh == 'v' ? (y == _.y && axis[0] > 0) || (y == (_.y + h) && axis[2] > 0) : (x == _.x && axis[3] > 0) || (x == (_.x + w) && axis[1] > 0);
				}
			}
		}
		var g = {
				solid : true,
				size : 10,
				fator : 1,
				width : _.get('grid_line_width'),
				color : _.get('grid_color')
			},
			ghs = iChart.applyIf(_.get('gridHStyle'),g),
			gvs = iChart.applyIf(_.get('gridVStyle'),g);
		
		if (k2g) {
			var scale, x, y, p;
			_.scale.each(function(scale) {
				p = scale.get('position');
				/**
				 * disable,given specfiy grid will ignore scale2grid
				 */
				if (iChart.isFalse(scale.get('scale2grid')) || hg && scale.get('which') == 'v' || vg && scale.get('which') == 'h') {
					return;
				}
				x = y = 0;
				if (p == _.O) {
					y = h;
				} else if (p == _.R) {
					x = -w;
				} else if (p == _.B) {
					y = -h;
				} else {
					x = w;
				}
				
				scale.items.each(function(item) {
					if (iol)
					_.gridlines.push(iChart.applyIf({
						overlap:ignoreOverlap.call(_, scale.get('which'), item.x, item.y),
						x1 : item.x,
						y1 : item.y,
						x2 : item.x + x,
						y2 : item.y + y
					},scale.isH?gvs:ghs));
				});
			});
		}
		if (vg) {
			var gv = _.get('grids.vertical');
			iChart.Assert.gt(gv['value'],0, 'value');
			var d = w / gv['value'], n = gv['value'];
			if (gv['way'] == 'given_value') {
				n = d;
				d = gv['value'];
				d = d > w ? w : d;
			}

			for ( var i = 0; i <= n; i++) {
				if (iol)
				_.gridlines.push(iChart.applyIf({
					overlap:ignoreOverlap.call(_, 'h', _.x + i * d, _.y),
					x1 : _.x + i * d,
					y1 : _.y,
					x2 : _.x + i * d,
					y2 : _.y + h,
					H : false,
					width : gvs.width,
					color : gvs.color
				},gvs));
			}
		}
		if (hg) {
			var gh = _.get('grids.horizontal');
			iChart.Assert.gt(gh['value'],0,'value');
			var d = h / gh['value'], n = gh['value'];
			if (gh['way'] == 'given_value') {
				n = d;
				d = gh['value'];
				d = d > h ? h : d;
			}

			for ( var i = 0; i <= n; i++) {
				if (iol)
				_.gridlines.push(iChart.applyIf({
					overlap:ignoreOverlap.call(_, 'v', _.x, _.y + i * d),
					x1 : _.x,
					y1 : _.y + i * d,
					x2 : _.x + w,
					y2 : _.y + i * d,
					H : true,
					width : ghs.width,
					color : ghs.color
				},ghs));
			}
		}
	}
});
/**
 * @end
 */
/**
 * @overview this component use for abc
 * @component#iChart.Coordinate3D
 * @extend#iChart.Coordinate2D
 */
iChart.Coordinate3D = iChart.extend(iChart.Coordinate2D, {
	configure : function() {
		/**
		 * invoked the super class's configurationuration
		 */
		iChart.Coordinate3D.superclass.configure.apply(this, arguments);

		/**
		 * indicate the component's type
		 */
		this.type = 'coordinate3d';
		this.dimension = iChart._3D;

		this.set({
			/**
			 * @cfg {Number} Three-dimensional rotation X in degree(angle).socpe{0-90},Normally, this will accord with the chart.(default to 60)
			 */
			xAngle : 60,
			/**
			 * @cfg {Number} Three-dimensional rotation Y in degree(angle).socpe{0-90},Normally, this will accord with the chart.(default to 20)
			 */
			yAngle : 20,
			xAngle_ : undefined,
			yAngle_ : undefined,
			/**
			 * @cfg {Number} Required,Specifies the z-axis deep of this coordinate,Normally, this will given by chart.(default to 0)
			 */
			zHeight : 0,
			/**
			 * @cfg {Number} Specifies pedestal height of this coordinate.(default to 22)
			 */
			pedestal_height : 22,
			/**
			 * @cfg {Number} Specifies board deep of this coordinate.(default to 20)
			 */
			board_deep : 20,
			/**
			 * @cfg {Boolean} If true display the left board.(default to true)
			 */
			left_board:true,
			/**
			 * @cfg {Boolean} Override the default as true
			 */
			gradient : true,
			/**
			 * @cfg {float} Override the default as 0.18.
			 */
			color_factor : 0.18,
			/**
			 * @cfg {Boolean} Override the default as true.
			 */
			ignoreEdge : true,
			/**
			 * @cfg {Boolean} Override the default as false.
			 */
			striped : false,
			/**
			 * @cfg {String} Override the default as '#a4ad96'.
			 */
			grid_color : '#a4ad96',
			/**
			 * @cfg {String} Override the default as '#d6dbd2'.
			 */
			background_color : '#d6dbd2',
			/**
			 * @cfg {Number} Override the default as 4.
			 */
			shadow_offsetx : 4,
			/**
			 * @cfg {Number} Override the default as 2.
			 */
			shadow_offsety : 2,
			/**
			 * @cfg {Array} Specifies the style of board(wall) of this coordinate. 
			 * the length of array will be 6,if less than 6,it will instead of <link>background_color</link>.and each object option has two property. Available property are:
			 * @Option color the color of wall
			 * @Option alpha the opacity of wall
			 */
			wall_style : [],
			/**
			 * @cfg {Boolean} Override the default as axis.enable = false.
			 */
			axis : {
				enable : false
			}
		});
	},
	doDraw : function(_) {
		var w = _.get(_.W), h = _.get(_.H), xa = _.get('xAngle_'), ya = _.get('yAngle_'), zh = _.get('zHeight'), offx = _.get('z_offx'), offy = _.get('z_offy');
		/**
		 * bottom
		 */
		if(_.get('pedestal_height'))
		_.T.cube3D(_.x, _.y + h + _.get('pedestal_height'), xa, ya, false, w, _.get('pedestal_height'), zh * 3 / 2, _.get('axis.enable'), _.get('axis.width'), _.get('axis.color'), _.get('bottom_style'));
		/**
		 * board_style
		 */
		if(_.get('board_deep'))
		_.T.cube3D(_.x +offx, _.y+h - offy, xa, ya, false, w, h, _.get('board_deep'), _.get('axis.enable'), _.get('axis.width'), _.get('axis.color'), _.get('board_style'));
		
		_.T.cube3D(_.x, _.y + h, xa, ya, false, w, h, zh, _.get('axis.enable'), _.get('axis.width'), _.get('axis.color'), _.get('wall_style'));
		
		_.gridlines.each(function(g) {
			if(g.solid){
				if(_.get('left_board'))
				_.T.line(g.x1, g.y1, g.x1 + offx, g.y1 - offy,g.width, g.color);
				_.T.line(g.x1 + offx, g.y1 - offy, g.x2 + offx, g.y2 - offy, g.width, g.color);
			}else{
				if(_.get('left_board'))
				_.T.dotted(g.x1, g.y1, g.x1 + offx, g.y1 - offy,g.width, g.color,g.size,g.fator);
				_.T.dotted(g.x1 + offx, g.y1 - offy, g.x2 + offx, g.y2 - offy, g.width, g.color,g.size,g.fator);
			}
		});
		_.scale.each(function(s) {
			s.draw();
		});
	},
	doConfig : function() {
		iChart.Coordinate3D.superclass.doConfig.call(this);

		var _ = this._(),
			ws = _.get('wall_style'),
			bg = _.get('background_color'),
			h = _.get(_.H),
			w = _.get(_.W),
			f = _.get('color_factor'),
			offx = _.push('z_offx',_.get('xAngle_') * _.get('zHeight')),
			offy = _.push('z_offy',_.get('yAngle_') * _.get('zHeight'));
			/**
			 * bottom-lower bottom-left
			 */
			while(ws.length < 6){
				ws.push({color : bg});
			}
			if(!_.get('left_board')){
				ws[2] = false;
				_.scale.each(function(s){
					s.doLayout(offx,-offy,s);
				});
			}
			
			/**
			 * right-front
			 */
			_.push('bottom_style', [{
				color : _.get('shadow_color'),
				shadow : _.get('shadow')
			}, false, false, {
				color : ws[3].color
			},false, {
				color : ws[3].color
			}]);
			
			/**
			 * right-top
			 */
			_.push('board_style', [false, false, false,{
				color : ws[4].color
			},{
				color : ws[5].color
			}, false]);
			
			/**
			 * lowerBottom-bottom-left-right-top-front
			 */
			if (_.get('gradient')) {
				if (iChart.isString(ws[0].color)) {
					ws[0].color = _.T.avgLinearGradient(_.x, _.y + h, _.x + w, _.y + h, [iChart.dark(ws[0].color,f/2+0.06),iChart.dark(ws[0].color,f/2+0.06)]);
				}
				if (iChart.isString(ws[1].color)) {
					ws[1].color = _.T.avgLinearGradient(_.x + offx, _.y - offy, _.x + offx, _.y + h - offy, [iChart.dark(ws[1].color,f),iChart.light(ws[1].color,f)]);
				}
				if (iChart.isString(ws[2].color)) {
					ws[2].color = _.T.avgLinearGradient(_.x, _.y, _.x, _.y + h, [iChart.light(ws[2].color,f/3),iChart.dark(ws[2].color,f)]);
				}
				_.get('bottom_style')[5].color = _.T.avgLinearGradient(_.x, _.y + h, _.x, _.y + h + _.get('pedestal_height'), [iChart.light(ws[3].color,f/2+0.06),iChart.dark(ws[3].color,f/2,0)]);
			}
			_.push('wall_style', [ws[0],ws[1],ws[2]]);
			
	}
});
/*
 * @end
 */

