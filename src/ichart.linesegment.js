/**
 * @overview the line segment componment
 * @component#iChart.LineSegment
 * @extend#iChart.Component
 */
iChart.LineSegment = iChart.extend(iChart.Component, {
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.LineSegment.superclass.configure.apply(this, arguments);

		/**
		 * indicate the component's type
		 */
		this.type = 'linesegment';

		this.set({
			/**
			 * @cfg {Number} Specifies the default linewidth of the canvas's context in this element.(defaults to 1)
			 */
			brushsize : 1,
			/**
			 * @cfg {Boolean} If true there show a point when Line-line intersection(default to true)
			 */
			intersection : true,
			/**
			 * @cfg {<link>iChart.Text</link>} Specifies the config of label,set false to make label disabled.
			 */
			label : {},
			/**
			 * @cfg {String} Specifies the shape of two line segment' point(default to 'round').Only applies when intersection is true Available value are:
			 * @Option 'round'
			 */
			sign : 'round',
			/**
			 * @cfg {String} Specifies the bgcolor when applies a Area.If not given,use lighter bgcolor of line.(default to null)
			 */
			area_color:null,
			/**
			 * @cfg {Boolean} If true the centre of point will be hollow.(default to true)
			 */
			hollow : true,
			/**
			 * @cfg {Boolean} If true the color of the centre of point will be hollow_color.else will be background_color.(default to true)
			 */
			hollow_inside:true,
			/**
			 * @cfg {String} Specifies the bgcolor when hollow applies true.(default to '#FEFEFE')
			 */
			hollow_color : '#FEFEFE',
			/**
			 * @cfg {Boolean} If true Line will smooth.(default to false)
			 */
			smooth : false,
			/**
			 * @cfg {Number} Specifies smoothness of line will be.(default to 1.5)
			 * 1 means control points midway between points, 2 means 1/3 from the point,formula is 1/(smoothing + 1) from the point
			 */
			smoothing : 1.5,
			/**
			 * @cfg {Number} Specifies the size of point.(default size 6).Only applies when intersection is true
			 */
			point_size : 6,
			/**
			 * @inner {Array} the set of points to compose line segment
			 */
			points : [],
			/**
			 * @inner {Boolean} If true the event accord width coordinate.(default to false)
			 */
			keep_with_coordinate : false,
			/**
			 * @cfg {Number} Override the default as 1
			 */
			shadow_blur : 1,
			/**
			 * @cfg {Number} Override the default as 1
			 */
			shadow_offsety : 1,
			/**
			 * @inner {Number} Specifies the space between two point
			 */
			point_space : 0,
			/**
			 * @inner {Object} reference of coordinate
			 */
			coordinate : null,
			/**
			 * @cfg {Number} Specifies the valid range of x-direction.(default to 0)
			 */
			event_range_x : 0,
			/**
			 * @cfg {Boolean} If true tip show when the mouse must enter the valid distance of axis y.(default to false)
			 */
			limit_y : false,
			/**
			 * @cfg {Number} Specifies the space between the tip and point.(default to 2)
			 */
			tip_offset : 2,
			/**
			 * @cfg {Number} Specifies the valid range of y-direction.(default to 0)
			 */
			event_range_y : 0
		});
		
		this.registerEvent(
				/**
				 * @event Fires when parse this label's data.Return value will override existing.
				 * @paramter <link>iChart.LineSegment</link>#seg
				 * @paramter string#text the current label's text
				 */
				'parseText');
		
		this.tip = null;
	},
	drawSegment : function() {
		var _ = this._();
		
		_.polygons.each(function(P){
			_.T.polygon.apply(_.T,P);
		});
		
		_.T.shadowOn(_.get('shadow'));
		
		_.lines.each(function(L){
			_.T.lineArray.apply(_.T,L);
		});
		
		_.intersections.each(function(I){
			if(_.sign_plugin){
				_.sign_plugin_fn.apply(_,I);
			}else{
				_.T.round0.apply(_.T,I);
			}
		});
		
		if (_.get('shadow')) {
			_.T.shadowOff();
		}
	},
	doDraw : function(_) {
		_.drawSegment();
		if (_.get('label')) {
			_.labels.each(function(l){
				l.draw();
			});
		}
	},
	isEventValid : function() {},
	tipInvoke : function() {
		var x = this.x, y = this.y, o = this.get('tip_offset'), s = this.get('point_size') + o, _ = this;
		return function(w, h, m) {
			var l = m.left, t = m.top;
			l = ((_.tipPosition < 3 && (l - w - x - o > 0)) || (_.tipPosition > 2 && (l - w - x - o < 0))) ? l - (w + o) : l + o;
			t = _.tipPosition % 2 == 0 ? t + s : t - h - s;
			return {
				left : l,
				top : t
			}
		}
	},
	PP:function(_,p,x1,y1,x2,y2){
		if(_.get('area')){
			_.polygons.push([_.get('area_color')||_.get('light_color2'),0,_.get('brushsize'),0,0,_.get('area_opacity'),_.get('smooth')?p:[{x:x1,y:y1}].concat(p.concat([{x:x2,y:y2}])),_.get('smooth'),_.get('smoothing') || 1.5,[{x:x1,y:y1},{x:x2,y:y2}]]);
		}
	},
	parse:function(_){
		_.polygons = [];
		_.lines = [];
		_.intersections = [];
		_.labels = [];
		
		var p = _.get('points'),I = _.get('intersection'),L = !!_.get('label'), T = [],Q  = false,s = _.get('smooth'), sm = _.get('smoothing') || 1.5, b = _.get('f_color'), h = _.get('brushsize'),ps=_.get('point_size');
		
		if (I) {
			var f = _.getPlugin('sign'),g=b,j = _.get('hollow_color');
			_.sign_plugin = iChart.isFunction(f);
			_.sign_plugin_fn = f;
			if(_.get('hollow_inside')){
				g = j;
				j = b;
			}
		}
		
		p.each(function(q){
			q.x_ = q.x;
			q.y_ = q.y;
			if(!q.ignored&&L){
				_.push('label.originx', q.x);
				_.push('label.originy', q.y-ps/2-1);
				_.push('label.text',_.fireString(_, 'parseText', [_, q.value],q.value));
				iChart.applyIf(_.get('label'),{
					textBaseline : 'bottom',
					color:_.get('f_color')
				});
				_.labels.push(new iChart.Text(_.get('label'), _))
			}
			if(q.ignored&&Q){
				_.lines.push([T, h, b, s, sm]);
				_.PP(_,T,T[0].x,_.y,T[T.length-1].x,_.y);
				T = [];
				Q = false;
			}else if(!q.ignored){
				T.push(q);
				Q = true;
			}
			
			if(I&&!q.ignored){
				_.intersections.push(_.sign_plugin?[_.T,_.get('sign'),q,ps,q.color||g,q.hollow_color||j]:_.get('hollow')?[q, ps/2-h+1,q.color||g,h+1,q.hollow_color||j]:[q,ps/2,q.color||g]);
			}
			
		});
		
		if(T.length){
			_.lines.push([T, h, b, s, sm]);
			_.PP(_,T,T[0].x,_.y,T[T.length-1].x,_.y);
		}
	},
	doConfig : function() {
		iChart.LineSegment.superclass.doConfig.call(this);
		iChart.Assert.isTrue(this.get('point_space')>0,'point_space');

		var _ = this._(), ps = _.get('point_size') * 3 / 2, sp = _.get('point_space'), ry = _.get('event_range_y'), rx = _
				.get('event_range_x'), heap = _.get('tipInvokeHeap'), p = _.get('points'), N = _.get('name');
		
		_.parse(_);
		
		if (rx <= 0||rx > sp / 2) {
			rx = _.push('event_range_x', sp / 2);
		}
		
		if (ry == 0) {
			ry = _.push('event_range_y', ps/2);
		}
		
		if (_.get('tip.enable')) {
			/**
			 * _ use for tip coincidence
			 */
			_.on('mouseover', function(c,e, m) {
				heap.push(_);
				_.tipPosition = heap.length;
			}).on('mouseout', function(c,e, m) {
				heap.pop();
			});
			_.push('tip.invokeOffsetDynamic', true);
			_.tip = new iChart.Tip(_.get('tip'), _);
		}
		
		var c = _.get('coordinate'), ly = _.get('limit_y'), k = _.get('keep_with_coordinate'), valid = function(p0, x, y) {
			if (!p0.ignored&&Math.abs(x - (p0.x)) < rx && (!ly || (ly && Math.abs(y - (p0.y)) < ry))) {
				return true;
			}
			return false;
		}, to = function(i) {
			return {
				valid : true,
				name : N,
				value : p[i].value,
				text : p[i].text,
				top : p[i].y,
				left : p[i].x,
				i:i,
				hit : true
			};
		};
		
		/**
		 * override the default method
		 */
		_.isEventValid = function(e) {
			if (c && !c.isEventValid(e,c).valid) {
				return {
					valid : false
				};
			}
			
			var ii = Math.floor((e.x - _.x) / sp);
			
			if (ii < 0 || ii >= (p.length - 1)) {
				ii = iChart.between(0, p.length - 1, ii);
				if (valid(p[ii], e.x, e.y))
					return to(ii);
				else
					return {
						valid : k
					};
			}
			
			/**
			 * calculate the pointer's position will between which two point?this function can improve location speed
			 */
			for ( var i = ii; i <= ii + 1; i++) {
				if (valid(p[i], e.x, e.y))
					return to(i);
			}
			return {
				valid : k
			};
		}

	}
});
/**
 *@end
 */	
