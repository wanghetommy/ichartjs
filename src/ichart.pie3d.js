/**
 * @overview the pie3d componment
 * @component#@chart#iChart.Pie3D
 * @extend#iChart.Pie
 */
iChart.Pie3D = iChart.extend(iChart.Pie, {
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Pie3D.superclass.configure.apply(this, arguments);

		this.type = 'pie3d';
		this.dimension = iChart._3D;

		this.set({
			/**
			 * @cfg {Number} Three-dimensional rotation Z in degree(angle).socpe{0-90}.(default to 45)
			 */
			zRotate : 45,
			/**
			 * @cfg {Number} Specifies the pie's thickness in pixels.(default to 30)
			 */
			yHeight : 30
		});
		this.positive = true;
	},
	doSector : function(_,d) {
		_.push('sub_option.cylinder_height', (d.cylinder_height ? d.cylinder_height * _.get('zRotate_') : _.get('cylinder_height')));
		return new iChart[_.sub](_.get('sub_option'), _);
	},
	one:function(_){
		var layer,spaint,L = [],c = _.get('counterclockwise'), abs = function(n,M) {
			/**
			 * If M,close to pi/2,else pi*3/2
			 */
			return 1 + Math.sin(M?(n+Math.PI):n);
		}, t = 'startAngle', d = 'endAngle',Q,s,e
		/**
		 * If the inside layer visibile
		 */
		lay =function(C,g,z,f){
			Q = iChart.quadrantd(g);
			if (C &&(Q ==0 || Q ==3) || (!C && (Q ==2 || Q ==1))) {
				layer.push({
					g : g,
					z : g==z,
					x : f.x,
					y : f.y,
					a : f.a,
					b : f.b,
					color : iChart.dark(f.get('background_color')),
					h : f.h,
					F : f
				});
			}
		};

		_.proxy = new iChart.Custom({
			z_index : _.get('z_index') + 1,
			drawFn : function() {
				this.drawSector();
				L = [];
				_.sectors.each(function(s) {
					if (s.get('label')) {
						if (s.expanded)
							L.push(s.label);
						else
							s.label.draw();
					}
				});
				L.each(function(l) {
					l.draw()
				});
			}
		});
		_.proxy.drawSector = function() {
			/**
			 * paint bottom layer
			 */
			_.sectors.each(function(s, i) {
				_.T.ellipse(s.x, s.y + s.h, s.a, s.b, s.get(t), s.get(d), 0, s.get('border.enable'), s.get('border.width'), s.get('border.color'), s.get('shadow'), c, true);
			}, _);
			layer = [];
			spaint = [];
			/**
			 * sort layer
			 */
			_.sectors.each(function(f) {
				lay(c,f.get(t),f.get(d),f);
				lay(!c,f.get(d),f.get(t),f);
				spaint = spaint.concat(iChart.visible(f.get(t),f.get(d),f));
			}, _);
			
			/**
			 * realtime sort
			 */
			layer.sor(function(p, q) {
				var r = abs(p.g) - abs(q.g);
				return r==0?p.z:r > 0;
			});

			/**
			 * paint inside layer
			 */
			layer.each(function(f, i) {
				_.T.sector3D.layerDraw.call(_.T, f.x, f.y, f.a + 0.5, f.b + 0.5, c, f.h, f.g, f.color);
			}, _);
			
			if(!_.processAnimation){	
				/**
				 * realtime sort
				 */
				spaint.sor(function(p, q) {
					return abs((p.s+p.e)/2,1) - abs((q.s+q.e)/2,1)<0;
				});
			}
			/**
			 * paint outside layer
			 */
			spaint.each(function(s, i) {
				_.T.sector3D.sPaint.call(_.T, s.f.x, s.f.y, s.f.a, s.f.b, s.s, s.e, c, s.f.h, s.f.get('f_color'));
			}, _);

			/**
			 * paint top layer
			 */
			_.sectors.each(function(s, i) {
				_.T.ellipse(s.x, s.y, s.a, s.b, s.get(t), s.get(d), s.get('f_color'), s.get('border.enable'), s.get('border.width'), s.get('border.color'), false, false, true);
			}, _);
		}
		_.one = $.emptyFn;
	},
	doConfig : function() {
		iChart.Pie3D.superclass.doConfig.call(this);
		var _ = this._(), z = iChart.angle2Radian(_.get('zRotate'));
		
		_.push('cylinder_height', _.get('yHeight') * _.push('zRotate_',Math.abs(Math.cos(z))));
		
		_.a = _.push('sub_option.semi_major_axis', _.r);
		_.b = _.push('sub_option.semi_minor_axis', _.r * Math.abs(Math.sin(z)));
		
		_.topY = _.push('sub_option.originy', _.get(_.Y) - _.get('yHeight') / 2);
		
		_.parse(_);
		
		_.one(_);
		
		_.components.push(_.proxy);
	}
});
iChart.register('Pie3D');
/**
 * @end
 */
