;
(function($) {

	var PI = Math.PI, inc = PI / 90,inc2 = inc/2, ceil = Math.ceil, floor = Math.floor, PI2 = 2 * PI, max = Math.max, min = Math.min, sin = Math.sin, cos = Math.cos, fd = function(w, c) {
		return w == 1 ? (floor(c) + 0.5) : Math.round(c);
	}, getCurvePoint = function(seg, point, i, smo) {
		var x = point.x, y = point.y, lp = seg[i - 1], np = seg[i + 1], lcx, lcy, rcx, rcy;
		if (i < seg.length - 1) {
			var lastY = lp.y, nextY = np.y, c;
			lcx = (smo * x + lp.x) / (smo + 1);
			lcy = (smo * y + lastY) / (smo + 1);
			rcx = (smo * x + np.x) / (smo + 1);
			rcy = (smo * y + nextY) / (smo + 1);

			c = ((rcy - lcy) * (rcx - x)) / (rcx - lcx) + y - rcy;
			lcy += c;
			rcy += c;

			if (lcy > lastY && lcy > y) {
				lcy = max(lastY, y);
				rcy = 2 * y - lcy;
			} else if (lcy < lastY && lcy < y) {
				lcy = min(lastY, y);
				rcy = 2 * y - lcy;
			}
			if (rcy > nextY && rcy > y) {
				rcy = max(nextY, y);
				lcy = 2 * y - rcy;
			} else if (rcy < nextY && rcy < y) {
				rcy = min(nextY, y);
				lcy = 2 * y - rcy;
			}
			point.rcx = rcx;
			point.rcy = rcy;
		}
		return [lp.rcx || lp.x, lp.rcy || lp.y, lcx || x, lcy || y, x, y];
	},
	pF = function(n){
		return $.isNumber(n)?n:$.parseFloat(n,n);
	},
	parse = function(c,_){
		var M,V=0,MI,ML=0,init=false,g = _.get('labels');
		_.data = c;
		if(_.dataType=='simple'){
			_.total = 0;
			c.each(function(d,i){
				d.background_color = d.color;
				V  = d.value||0;
				if($.isArray(V)){
					var T = 0;
					ML = V.length>ML?V.length:ML;
					for(var j=0;j<V.length;j++){
						V[j] = pF(V[j]);
						T+=V[j];
						if(!init){
							M = MI = V[j];
							init=true;
						}
						M = max(V[j],M);
						MI = min(V[j],MI);
					}
					d.total = T;
				}else{
					V = pF(V);
					d.value = V;
					_.total+=V;
					if(!init){
						M = MI = V;
						init=true;
					}
					M = max(V,M);
					MI = min(V,MI);
				}
			},_);
			
			if($.isArray(g)){
				ML = g.length>ML?g.length:ML;
			}
			_.push('maxItemSize',ML);
		}else if(_.dataType=='stacked'||_.dataType=='complex'){
			var L=g.length,item,T,r,stack=_.dataType=='stacked';
			if(L==0){
				L=c[0].value.length;for(var i=0;i<L;i++)g.push("");
			}
			_.columns = [];
			for(var i=0;i<L;i++){
				item = [],T = 0;
				c.each(function(d,j){
					V = d.value[i];
					if(!V)return;
					d.value[i] = V =  pF(V,V);
					T+=V;
					if(stack){
						r = c[j].color;
					}else{
						r = d.color;
						if(!init){
							M = MI = V;
							init=true;
						}
						M = max(V,M);
						MI = min(V,MI);
					}
					item.push($.applyIf({
						name:d.name,
						value:d.value[i],
						background_color:r,
						color:r
					},$.isArray(d.extra)?(d.extra[i]||{}):d));					
				});
				if(stack){
					if(!init){
						M = MI = V;
						init=true;
					}
					M = max(T,M);
					MI = min(T,MI);
				}	
				_.columns.push({
					total:T,
					name:g[i],
					item:item
				});
			}
		}
		_.push('minValue',MI); 
		_.push('maxValue',M);
		_.doConfig();
		_.initialization = true;
	};
	
	/**
	 * @private support an improved API for drawing in canvas
	 */
	function Cans(c) {
		if (typeof c === "string")
			c = $(c);
		if (!c || !c['tagName'] || c['tagName'].toLowerCase() != 'canvas')
			throw new Error("there not a canvas element");

		this.canvas = c;
		this.c = this.canvas.getContext("2d");
	}

	Cans.prototype = {
		getContext:function(){
			return this.c;
		},		
		css : function(a, s) {
			if ($.isDefined(s))
				this.canvas.style[a] = s;
			else
				return this.canvas.style[a];
		},
		/**
		 * draw ellipse API
		 */
		ellipse : function(x, y, a, b, s, e, c, bo, bow, boc, sw, ccw, a2r, last) {
			var angle = s,a2r = !!a2r;
			this.save().gCo(last).strokeStyle(bo,bow, boc).shadowOn(sw).fillStyle(c).moveTo(x, y).beginPath();
			
			if (a2r)
				this.moveTo(x, y);
			
			while (angle <= e) {
				this.lineTo(x + a * cos(angle), y + (b * sin(angle)));
				angle += inc;
			}
			return this.lineTo(x + a * cos(e), y + (b * sin(e))).closePath().stroke(bo).fill(c).restore();
		},
		/**
		 * arc
		 */
		arc : function(x, y, r, dw, s, e, c, b, bw, bc, sw, ccw, a2r, last) {
			if(b)
			r-=floor(bw/2);
			if(r<=0)return this;
			this.save().gCo(last).strokeStyle(b,bw,bc).fillStyle(c).beginPath();
			if(dw){
				this.moveTo(x+cos(s)*(r-dw),y+sin(s)*(r-dw)).lineTo(x+cos(s)*r,y+sin(s)*r);
				this.c.arc(x, y, r, s, e,ccw);
				this.lineTo(x+cos(e)*(r-dw),y+sin(e)*(r-dw));
				this.c.arc(x, y, r-dw, e, s,!ccw);
			}else{
				this.c.arc(x, y, r, s, e, ccw);
				if (a2r)
					this.lineTo(x, y);
			}
			
			this.closePath();
			if(!b){
				this.shadowOn(sw).fill(c);
			}else{
				this.shadowOn(sw).stroke(b).shadowOff().fill(c);
			}
			
			return this.restore();
		},
		/**
		 * draw sector
		 */
		sector : function(x, y, r, dw,s, e, c, b, bw, bc, sw, ccw,a2a,font) {
			if (sw)
				this.arc(x, y, r, dw, s, e,c,b,bw,bc,sw,ccw, !a2a, !font);
			return this.arc(x, y, r, dw, s, e, c, b, bw, bc, false, ccw, !a2a);
		},
		sector3D : function() {
			var x0, y0,sPaint = function(x, y, a, b, s, e, ccw, h, c) {
				var Lo = function(A, h) {
					this.lineTo(x + a * cos(A), y + (h || 0) + (b * sin(A)));
				},
				angle = s;
				this.fillStyle($.dark(c)).moveTo(x + a * cos(s), y + (b * sin(s))).beginPath();
				while (angle <= e) {
					Lo.call(this, angle);
					angle = angle + inc;
				}
				Lo.call(this, e);
				this.lineTo(x + a * cos(e), (y + h) + (b * sin(e)));
				angle = e;
				while (angle >= s) {
					Lo.call(this, angle, h);
					angle = angle - inc;
				}
				Lo.call(this, s, h);
				this.lineTo(x + a * cos(s), y + (b * sin(s))).closePath().fill(true);
			}, layerDraw = function(x, y, a, b, ccw, h, A, c) {
				var x0 = x + a * cos(A);
				var y0 = y + h + (b * sin(A));
				this.moveTo(x, y).beginPath().fillStyle(c).lineTo(x, y + h).lineTo(x0, y0).lineTo(x0, y0 - h).lineTo(x, y).closePath().fill(true);
			}, layerPaint = function(x, y, a, b, s, e, ccw, h, c) {
				var q1 = $.quadrantd(s),q2 = $.quadrantd(e);
				c = $.dark(c);
				if (q1==1||q1==2)
					layerDraw.call(this, x, y, a, b, ccw, h, s, c);
				if (q2==0||q2==3)
					layerDraw.call(this, x, y, a, b, ccw, h, e, c);
			};
			var s3 = function(x, y, a, b, s, e, h, c, bo, bow, boc, sw, ccw, isw) {
				/**
				 * paint bottom layer
				 */
				this.ellipse(x, y + h, a, b, s, e, c, bo, bow, boc, sw, ccw, true);
				/**
				 * paint inside layer
				 */
				layerPaint.call(this, x, y, a, b, s, e, ccw, h, c);

				/**
				 * paint top layer
				 */
				this.ellipse(x, y, a, b, s, e, c, bo, bow, boc, false, ccw, true);
				/**
				 * paint outside layer
				 */
				sPaint.call(this, x, y, a, b, s, e, ccw, h, c);
				return this;
			}
			s3.layerPaint = layerPaint;
			s3.sPaint = sPaint;
			s3.layerDraw = layerDraw;
			return s3;
		}(),
		textStyle : function(a, l, f) {
			return this.textAlign(a).textBaseline(l).textFont(f);
		},
		strokeStyle : function(b,w, c, j) {
			if(b){
				if (w)
					this.c.lineWidth = w;
				if (c)
					this.c.strokeStyle = c;
				if (j)
					this.c.lineJoin = j;
			}
			return this;
		},
		globalAlpha : function(v) {
			if (v)
				this.c.globalAlpha = v;
			return this;
		},
		fillStyle : function(c) {
			if (c)
				this.c.fillStyle = c;
			return this;
		},
		arc2 : function(x, y, r, s, e, c) {
			if(r)
			this.c.arc(x, y, r, s, e, c);
			return this;
		},
		textAlign : function(a) {
			if (a)
				this.c.textAlign = a;
			return this;
		},
		textBaseline : function(l) {
			if (l)
				this.c.textBaseline = l;
			return this;
		},
		textFont : function(font) {
			if (font)
				this.c.font = font;
			return this;
		},
		shadowOn : function(s) {
			if (s) {
				this.c.shadowColor = s.color;
				this.c.shadowBlur = s.blur;
				this.c.shadowOffsetX = s.offsetx;
				this.c.shadowOffsetY = s.offsety;
			}
			return this;
		},
		shadowOff : function() {
			this.c.shadowColor = 'white';
			this.c.shadowBlur = this.c.shadowOffsetX = this.c.shadowOffsetY = 0;
			return this;
		},
		gradient : function(x, y, w, h, c,m,r) {
			m = m.toLowerCase();
			var x0=x,y0=y,f=!m.indexOf("linear");
			m = m.substring(14);
			if(f){
			switch (m) {
				case 'updown':
					y0 += h;
					break;
				case 'downup':
					y += h;
					break;
				case 'leftright':
					x0 += w;
					break;
				case 'rightleft':
					x += w;
					break;
				default:
					return c[0];
				}
				return this.avgLinearGradient(x, y, x0, y0, c);
			}else{
				x+=w/2;
				y+=h/2;
				return this.avgRadialGradient(x,y,(r||0),x,y,(w>h?h:w),m=='outin'?c.reverse():c);
			}
		},
		avgLinearGradient : function(xs, ys, xe, ye, c) {
			var g = this.createLinearGradient(xs, ys, xe, ye);
			for ( var i = 0; i < c.length; i++)
				g.addColorStop(i / (c.length - 1), c[i]);
			return g;
		},
		createLinearGradient : function(xs, ys, xe, ye) {
			return this.c.createLinearGradient(xs, ys, xe, ye);
		},
		avgRadialGradient : function(xs, ys, rs, xe, ye, re, c) {
			var g = this.createRadialGradient(xs, ys, rs, xe, ye, re);
			for ( var i = 0; i < c.length; i++)
				g.addColorStop(i/ (c.length - 1), c[i]);
			return g;
		},
		createRadialGradient : function(xs, ys, rs, xe, ye, re) {
			return this.c.createRadialGradient(xs, ys, rs, xe, ye, re);
		},
		text : function(t, x, y, max, color, align, line, font, mode, h,sw,ro) {
			return this.save().textStyle(align, line, font).fillText(t, x, y, max, color, mode, h,sw,ro).restore();
		},
		fillText : function(t, x, y, max, color, mode, h,sw,ro) {
			t = t.toString();
			if(!t||!t.length)return this;
			max = max || false;
			mode = mode || 'lr';
			h = h || 16;
			x = fd(0, x);
			y = fd(0, y);
			var T = t.split(mode == 'tb' ? "" : "\n");
			if(T.length>1){
				if(this.c.textBaseline=='middle'){
					y = y - (T.length-1)*h/2;
				}else if(this.c.textBaseline=='bottom'){
					y = y - (T.length-1)*h;
				}
			}
			this.save().fillStyle(color).translate(x,y).rotate(inc2*ro).shadowOn(sw);
			T.each(function(t,i) {
				try {
					if (max&&max>0)
						this.c.fillText(t, 0,i*h, max);
					else
						this.c.fillText(t, 0, i*h);
				} catch (e) {
					console.log(e.message + '[' + t + ',' + x + ',' + y + ']');
				}
			}, this);
			
			return this.restore();
		},
		measureText : function(t){
			t = t.split("\n");
			var m=0;
			t.each(function(o){
				m = max(this.measureText(o).width,m);
			},this.c);
			return m;
		},
		moveTo : function(x, y) {
			x = x || 0;
			y = y || 0;
			this.c.moveTo(x, y);
			return this;
		},
		lineTo : function(x, y) {
			x = x || 0;
			y = y || 0;
			this.c.lineTo(x, y);
			return this;
		},
		save : function() {
			this.c.save();
			return this;
		},
		restore : function() {
			this.c.restore();
			return this;
		},
		beginPath : function() {
			this.c.beginPath();
			return this;
		},
		closePath : function() {
			this.c.closePath();
			return this;
		},
		stroke : function(s) {
			if(s)
			this.c.stroke();
			return this;
		},
		fill : function(f) {
			if(f)
			this.c.fill();
			return this;
		},
		/**
		 * can use cube3D instead of this?
		 */
		cube : function(x, y, xv, yv, width, height, zdeep, bg, b, bw, bc, sw) {
			x = fd(bw, x);
			y = fd(bw, y);
			zdeep = (zdeep && zdeep > 0) ? zdeep : width;
			var x1 = x + zdeep * xv, y1 = y - zdeep * yv;
			x1 = fd(bw, x1);
			y1 = fd(bw, y1);
			/**
			 * styles -> top-front-right
			 */
			if (sw) {
				this.polygon(bg, b, bw, bc, sw, false, [{x:x, y:y},{x: x1, y:y1},{x: x1 + width, y:y1},{x: x + width, y:y}]);
				this.polygon(bg, b, bw, bc, sw, false, [{x:x, y:y},{x: x, y:y + height},{x: x + width,y: y + height},{x: x + width, y:y}]);
				this.polygon(bg, b, bw, bc, sw, false, [{x:x + width, y:y},{x: x1 + width, y:y1},{x: x1 + width, y:y1 + height},{x: x + width, y:y + height}]);
			}
			/**
			 * clear the shadow on the body
			 */
			this.polygon($.dark(bg), b, bw, bc, false, false, [{x:x, y:y}, {x:x1, y:y1}, {x:x1 + width, y:y1}, {x:x + width, y:y}]);
			this.polygon(bg, b, bw, bc, false, false, [{x:x, y:y}, {x:x, y:y + height}, {x:x + width, y:y + height}, {x:x + width,y: y}]);
			this.polygon($.dark(bg), b, bw, bc, false, false, [{x:x + width, y:y}, {x:x1 + width, y:y1}, {x:x1 + width, y:y1 + height}, {x:x + width, y:y + height}]);
			return this;
		},
		cube3D : function(x, y, rotatex, rotatey, angle, w, h, zh, b, bw, bc, styles) {
			/**
			 * styles -> lowerBottom-bottom-left-right-top-front
			 */
			x = fd(bw, x);
			y = fd(bw, y);
			zh = (!zh || zh == 0) ? w : zh;

			if (angle) {
				var P = $.vectorP2P(rotatex, rotatey);
				rotatex = x + zh * P.x, rotatey = y - zh * P.y;
			} else {
				rotatex = x + zh * rotatex, rotatey = y - zh * rotatey;
			}

			while (styles.length < 6)
				styles.push(false);

			rotatex = fd(bw, rotatex);
			rotatey = fd(bw, rotatey);

			var side = [];

			if (rotatey < 0) {
				if ($.isObject(styles[4]))
					side.push($.applyIf({
						points : [{x:x,y:y - h},{x:rotatex,y:rotatey - h},{x:rotatex + w, y:rotatey - h},{x: x + w, y:y - h}]
					}, styles[4]));
			} else {
				if ($.isObject(styles[0]))
					side.push($.applyIf({
						points : [{x:x, y:y},{x: rotatex, y:rotatey},{x: rotatex + w, y:rotatey},{x: x + w,y:y}]
					}, styles[0]));
			}

			if ($.isObject(styles[1]))
				side.push($.applyIf({
					points : [{x:rotatex, y:rotatey},{x: rotatex, y:rotatey - h}, {x:rotatex + w, y:rotatey - h},{x: rotatex + w,y:rotatey}]
				}, styles[1]));

			if ($.isObject(styles[2]))
				side.push($.applyIf({
					points : [{x:x, y:y}, {x:x, y:y - h},{x: rotatex, y:rotatey - h},{x: rotatex, y:rotatey}]
				}, styles[2]));

			if ($.isObject(styles[3]))
				side.push($.applyIf({
					points : [{x:x + w, y:y}, {x:x + w, y:y - h}, {x:rotatex + w, y:rotatey - h}, {x:rotatex + w, y:rotatey}]
				}, styles[3]));

			if (rotatey < 0) {
				if ($.isObject(styles[0]))
					side.push($.applyIf({
						points : [{x:x,y: y}, {x:rotatex, y:rotatey}, {x:rotatex + w, y:rotatey}, {x:x + w, y:y}]
					}, styles[0]));
			} else {
				if ($.isObject(styles[4]))
					side.push($.applyIf({
						points : [{x:x, y:y - h}, {x:rotatex, y:rotatey - h}, {x:rotatex + w, y:rotatey - h}, {x:x + w, y:y - h}]
					}, styles[4]));
			}

			if ($.isObject(styles[5]))
				side.push($.applyIf({
					points : [{x:x, y:y}, {x:x, y:y - h}, {x:x + w, y:y - h}, {x:x + w, y:y}]
				}, styles[5]));
			
			side.each(function(s) {
				this.polygon(s.color, b, bw, bc, s.shadow, s.alpha, s.points);
			}, this);
			
			return this;
		},
		polygon : function(bg, b, bw, bc, sw, alpham, p, smooth, smo,l) {
			this.save().strokeStyle(b,bw, bc).beginPath().fillStyle(bg).globalAlpha(alpham).shadowOn(sw).moveTo(p[0].x,p[0].y);
			if (smooth) {
				this.moveTo(fd(bw,l[0].x),fd(bw,l[0].y)).lineTo(fd(bw, p[0].x), fd(bw, p[0].y));
				for ( var i = 1; i < p.length; i++)
					this.bezierCurveTo(getCurvePoint(p, p[i], i, smo));
				this.lineTo(fd(bw,l[1].x),fd(bw,l[1].y));
			} else {
				for ( var i = 1; i < p.length; i++)
					this.lineTo(fd(bw, p[i].x), fd(bw, p[i].y));
			}
			return this.closePath().stroke(b).fill(bg).restore();
		},
		lines : function(p, w, c, last) {
			if(!w)return this;
			this.save().gCo(last).beginPath().strokeStyle(true,w, c).moveTo(fd(w, p[0]), fd(w, p[1]));
			for ( var i = 2; i < p.length - 1; i += 2) {
				this.lineTo(fd(w, p[i]), fd(w, p[i + 1]));
			}
			return this.stroke(true).restore();
		},
		bezierCurveTo : function(r) {
			this.c.bezierCurveTo(r[0], r[1], r[2], r[3], r[4], r[5]);
			return this;
		},
		label : function(p, w, c) {
			return this.save()
				.beginPath()
				.strokeStyle(true,w, c)
				.moveTo(fd(w, p[0].x), fd(w, p[0].y))
				.bezierCurveTo([p[1].x,p[1].y,p[2].x,p[2].y,p[3].x,p[3].y])
				.stroke(true)
				.restore();
		},
		lineArray : function(p, w, c, smooth, smo) {
			if(!w)return this;
			this.save().beginPath().strokeStyle(true,w, c).moveTo(fd(w, p[0].x), fd(w, p[0].y));
			for ( var i = 1; i < p.length; i++){
				if (smooth) {
					this.bezierCurveTo(getCurvePoint(p, p[i], i, smo || 1.5));
				} else {
					this.lineTo(fd(w, p[i].x), fd(w, p[i].y));
				}
			}
			return this.stroke(true).restore();
		},
		dotted : function(x1, y1, x2, y2, w, c,L,f,last) {
			if (!w)
				return this;
			x1 = fd(w, x1);
			y1 = fd(w, y1);
			x2 = fd(w, x2);
			y2 = fd(w, y2);
			var d = $.distanceP2P(x1, y1, x2, y2),t;
			if(L<=0||d<=L||(x1!=x2&&y1!=y2)){
				return this.line(x1, y1, x2, y2, w, c, last);
			}
			if(x1>x2||y1>y2){
				t = x1;
				x1 = x2;
				x2 = t;
				t = y1;
				y1 = y2;
				y2 = t;
			}
			this.save().gCo(last).strokeStyle(true,w, c).beginPath().moveTo(x1,y1);
			var S = L*(f || 1),g = floor(d/(L+S)),k = (d-g*(L+S))>L,h=(y1==y2);
			g = k?g+1:g;
			for(var i=1;i<=g;i++){
				this.lineTo(h?x1+L*i+S*(i-1):x1,h?y1:y1+L*i+S*(i-1)).moveTo(h?x1+(L+S)*i:x1, h?y1:y1+(L+S)*i);
			}
			if(!k){
				this.lineTo(x2,y2);
			}
			return this.stroke(true).restore();
		},
		line : function(x1, y1, x2, y2, w, c, last) {
			if (!w)
				return this;
			this.save().gCo(last);
			return this.beginPath().strokeStyle(true,w, c).moveTo(fd(w, x1), fd(w, y1)).lineTo(fd(w, x2), fd(w, y2)).stroke(true).restore();
		},
		round : function(x, y, r, c, bw, bc) {
			return this.arc(x, y, r,0, 0, PI2, c, !!bc, bw, bc);
		},
		round0 : function(q, r, c, bw, bc) {
			return this.arc(q.x, q.y, r,0, 0, PI2, c, !!bc, bw, bc);
		},
		fillRect : function(x, y, w, h) {
			this.c.fillRect(x, y, w, h);
			return this;
		},
		translate : function(x, y) {
			this.c.translate(x, y);
			return this;
		},
		rotate : function(r) {
			this.c.rotate(r);
			return this;
		},
		clearRect : function(x, y, w, h) {
			x = x || 0;
			y = y || 0;
			w = w || this.canvas.width;
			h = h || this.canvas.height;
			this.c.clearRect(x, y, w, h);
			return this;
		},
		gCo : function(l) {
			if(l)
			return this.gCO(l);
			return this;
		},
		gCO : function(l) {
			this.c.globalCompositeOperation = l ? "destination-over" : "source-over";
			return this;
		},
		box : function(x, y, w, h, b, bg, shadow, m,last) {
			b = b || {
				enable : 0
			}
			if (b.enable) {
				var j = b.width, c = b.color, r = b.radius, f = $.isNumber(j);
				j = $.parsePadding(j);
				if(j[0]==j[1]&&j[1]==j[2]&&j[2]==j[3]){
					f = true;
				}
				m = m?1:-1;
				w += m*(j[1] + j[3]) / 2;
				h += m*(j[0] + j[2]) / 2;
				x -= m*(j[3] / 2);
				y -= m*(j[0] / 2);
				j = f ? j[0] : j;
				r = (!f ||!r|| r == 0 || r == '0') ? 0 : $.parsePadding(r);
			}
			
			this.save().gCo(last).fillStyle(bg).strokeStyle(f,j, c);
			/**
			 * draw a round corners border
			 */
			if (r) {
				this.beginPath().moveTo(fd(j,x+r[0]), fd(j, y))
				.lineTo(fd(j,x+w - r[1]), fd(j, y))
				.arc2(fd(j,x+w - r[1]), fd(j, y+r[1]), r[1], PI*3/2, PI2)
				.lineTo(fd(j, x+w), fd(j,y+h - r[2]))
				.arc2(fd(j,x+w - r[2]), fd(j, y+h-r[2]), r[2], 0, PI/2)
				.lineTo(fd(j,x+r[3]), fd(j, y+h))
				.arc2(fd(j,x+r[3]), fd(j, y+h-r[3]), r[3], PI/2, PI)
				.lineTo(fd(j,x), fd(j,y+r[0]))
				.arc2(fd(j,x+r[0]), fd(j, y+r[0]), r[0], PI, PI*3/2)
				.closePath().shadowOn(shadow).stroke(j).shadowOff().fill(bg);
			} else {
				if (!b.enable || f) {
					if (j&&b.enable){
						this.shadowOn(shadow).c.strokeRect(x, y, w, h);
						this.shadowOff();
					}
					if (bg)
						this.fillRect(x, y, w, h);
				} else {
					if(j){
						c = $.isArray(c) ? c : [c, c, c, c];
						this.shadowOn(shadow).line(x+w, y+j[0] / 2, x+w, y+h - j[0] / 2, j[1], c[1], 0).line(x, y+j[0] / 2, x, y+h - j[0] / 2, j[3], c[3], 0).line(floor(x-j[3] / 2),y, x+w + j[1] / 2, y, j[0], c[0], 0).line(floor(x-j[3] / 2), y+h, x+w + j[1] / 2, y+h, j[2], c[2], 0).shadowOff();
					}
					if (bg) {
						this.beginPath().moveTo(floor(x+j[3] / 2), floor(y+j[0] / 2)).lineTo(ceil(x+w - j[1] / 2), y+j[0] / 2).lineTo(ceil(x+w - j[1] / 2), ceil(y+h - j[2] / 2)).lineTo(floor(x+j[3] / 2), ceil(y+h - j[2] / 2)).lineTo(floor(x+j[3] / 2), floor(y+j[0] / 2)).closePath().fill(bg);
					}
				}

			}
			return this.restore();
		},
		toDataURL : function(g) {
			return this.canvas.toDataURL(g || "image/png");
		},
		addEvent : function(type, fn, useCapture) {
			$.Event.addEvent(this.canvas, type, fn, useCapture);
		}
	}
	
	/**
	 * the public method,inner use
	 */
	$.taylor = {
		light:function(_,e){
			e.highlight = false;
			_.on('mouseover',function(){
				e.highlight = true;
				_.redraw('mouseover');
			}).on('mouseout',function(){
				e.highlight = false;
				_.redraw('mouseout');
			}).on('beforedraw',function(){
				_.push('f_color',e.highlight?_.get('light_color'):_.get('f_color_'));
				return true;
			});
		}	
	}
	
	/**
	 * @overview this component is a super class of all chart
	 * @component#iChart.Chart
	 * @extend#iChart.Painter
	 */
	$.Chart = $.extend($.Painter, {
		/**
		 * @cfg {TypeName}
		 */
		configure : function() {
			/**
			 * invoked the super class's configuration
			 */
			$.Chart.superclass.configure.apply(this, arguments);

			/**
			 * indicate the element's type
			 */
			this.type = 'chart';
			/**
			 * indicate the data structure
			 */
			this.dataType = 'simple';

			this.set({
				/**
				 * @cfg {String} The unique id of this element (defaults to an auto-assigned id).
				 */
				id : '',
				/**
				 * @cfg {String} id of dom you want rendered(defaults '').
				 */
				render : '',
				/**
				 * @cfg {Array} Required,The datasource of Chart.must be not empty.
				 */
				data : [],
				/**
				 * @cfg {Number} Specifies the width of this canvas
				 */
				width : undefined,
				/**
				 * @cfg {Number} Specifies the height of this canvas
				 */
				height : undefined,
				/**
				 * @cfg {String} Specifies the default lineJoin of the canvas's context in this element.(defaults to 'round')
				 */
				lineJoin : 'round',
				/**
				 * @cfg {String} this property specifies the horizontal alignment of chart in an module (defaults to 'center') Available value are:
				 * @Option 'left'
				 * @Option 'center'
				 * @Option 'right'
				 */
				align : 'center',
				/**
				 * @cfg {Boolean} If true mouse change to a pointer when a mouseover fired.only available when use PC.(defaults to true)
				 */
				default_mouseover_css : true,
				/**
				 * @cfg {Boolean} If true ignore the event touchmove.only available when support touchEvent.(defaults to false)
				 */
				turn_off_touchmove : false,
				/**
				 * @cfg {Boolean} Specifies as true to display with percent.(default to false)
				 */
				showpercent : false,
				/**
				 * @cfg {Number} Specifies the number of decimal when use percent.(default to 1)
				 */
				decimalsnum : 1,
				/**
				 * @cfg {Object/String} Specifies the config of Title details see <link>iChart.Text</link>,If given a string,it will only apply the text.note:If the text is empty,then will not display
				 */
				title : {
					text : '',
					fontweight : 'bold',
					/**
					 * Specifies the font-size in pixels of title.(default to 20)
					 */
					fontsize : 20,
					/**
					 * Specifies the height of title will be take.(default to 30)
					 */
					height : 30
				},
				/**
				 * @cfg {Object/String}Specifies the config of subtitle details see <link>iChart.Text</link>,If given a string,it will only apply the text.note:If the title or subtitle'text is empty,then will not display
				 */
				subtitle : {
					text : '',
					fontweight : 'bold',
					/**
					 * Specifies the font-size in pixels of title.(default to 16)
					 */
					fontsize : 16,
					/**
					 * Specifies the height of title will be take.(default to 20)
					 */
					height : 20
				},
				/**
				 * @cfg {Object/String}Specifies the config of footnote details see <link>iChart.Text</link>,If given a string,it will only apply the text.note:If the text is empty,then will not display
				 */
				footnote : {
					text : '',
					/**
					 * Specifies the font-color of footnote.(default to '#5d7f97')
					 */
					color : '#5d7f97',
					textAlign : 'right',
					/**
					 * Specifies the height of title will be take.(default to 20)
					 */
					height : 20
				},
				/**
				 * @cfg {Boolean} If true element will have a animation when show, false to skip the animation.(default to false)
				 */
				animation : false,
				/**
				 * @Function {Function} the custom funtion for animation.(default to null)
				 */
				doAnimation : null,
				/**
				 * @cfg {String} (default to 'ease-in-out') Available value are:
				 * @Option 'easeIn'
				 * @Option 'easeOut'
				 * @Option 'easeInOut'
				 * @Option 'linear'
				 */
				animation_timing_function : 'easeInOut',
				/**
				 * @cfg {Number} Specifies the duration when animation complete in millisecond.(default to 1000)
				 */
				animation_duration : 1000,
				/**
				 * @cfg {Number} Specifies the chart's z_index.override the default as 999 to make it at top layer.(default to 999)
				 */
				z_index:999,
				/**
				 * @cfg {Object}Specifies the config of Legend.For details see <link>iChart.Legend</link> Note:this has a extra property named 'enable',indicate whether legend available(default to false)
				 */
				legend : {
					enable : false
				},
				/**
				 * @cfg {Object} Specifies the config of Tip.For details see <link>iChart.Tip</link> Note:this has a extra property named 'enable',indicate whether tip available(default to false)
				 */
				tip : {
					enable : false
				}
			});

			/**
			 * register the common event
			 */
			this.registerEvent(
			/**
			 * @event Fires before this element Animation.Only valid when <link>animation</link> is true
			 * @paramter iChart.Chart#this
			 */
			'beforeAnimation',
			/**
			 * @event Fires when this element Animation finished.Only valid when <link>animation</link> is true
			 * @paramter iChart.Chart#this
			 */
			'afterAnimation',
			/**
			 * @event Fires when chart resize.
			 * @paramter int#width chart's width
			 * @paramter int#height chart's height
			 * @return Object object the new config for chart
			 */
			'resize',
			'animating');

			this.T = null;
			this.Rendered = false;
			this.Combination = false;
			this.Animationed = false;
			this.show = false;
			this.data = [];
			this.plugins = [];
			this.components = [];
			this.oneways = [];
			this.total = 0;
			this.ICHARTJS_CHART = true;
		},
		toDataURL : function(g) {
			return this.T.toDataURL(g);
		},
		segmentRect : function() {
			if(!this.Combination)
			this.T.clearRect();
		},
		resetCanvas : function() {
			if(!this.Combination)
			this.T.box(this.get('l_originx'), this.get('t_originy'), this.get('client_width'), this.get('client_height'),0,this.get('f_color'),0,0,true);
		},
		animation : function(_) {
			/**
			 * clear the part of canvas
			 */
			_.segmentRect();
			
			/**
			 * draw coordinate
			 */
			if(_.coo&&!_.ILLUSIVE_COO)
				_.coo.draw();
			
			/**
			 * doAnimation of implement
			 */
			_.doAnimation(_.variable.animation.time, _.duration,_);
			
			/**
			 * draw plugins
			 */
			_.plugins.each(function(p){
				if(p.A_draw){
					p.variable.animation.animating =true;
					p.variable.animation.time =_.variable.animation.time;
					p.draw();
					p.variable.animation.animating =false;
				}
			});
			
			if(_.Combination){
				return;
			}
			
			_.oneways.each(function(o) {o.draw()});
			
			if (_.variable.animation.time < _.duration) {
				_.variable.animation.time++;
				$.requestAnimFrame(function() {
					_.animation(_);
				});
			} else {
				$.requestAnimFrame(function() {
					_.Animationed = true;
					
					/**
					 * make plugins's status is the same as chart
					 */
					_.plugins.each(function(p){
						p.Animationed = true;
					});
					_.processAnimation = false;
					_.draw();
					_.plugins.each(function(p){
						p.processAnimation = false;
					});
					_.fireEvent(_, 'afterAnimation', [_]);
				});
			}
		},
		runAnimation : function(_) {
			_.fireEvent(_, 'beforeAnimation', [_]);
			if(!_.A_draw)
			_.variable.animation = {
				type : 0,
				time : 0,
				queue : []
			}
			_.processAnimation = true;
			_.animation(_);
		},
		doSort:function(){
			var f = function(p, q){return ($.isArray(p)?(p.zIndex||0):p.get('z_index'))>($.isArray(q)?(q.zIndex||0):q.get('z_index'))};
			this.components.sor(f);
			this.oneways.sor(f);
		},
		commonDraw : function(_,e) {
			_.show = false;
			
			if (!_.redraw) {
				$.Assert.isTrue(_.Rendered, _.type + ' has not rendered');
				$.Assert.isTrue(_.data&&_.data.length>0,_.type + '\'s data is empty');
				$.Assert.isTrue(_.initialization, _.type + ' Failed to initialize');
				_.doSort();
			}
			
			_.redraw = true;
			
			if (!_.Animationed && _.get('animation')) {
				_.runAnimation(_);
				return;
			}
			_.segmentRect();
			//order?
			_.components.eachAll(function(c) {
				c.draw(e);
			});
			_.components.eachAll(function(c) {
				if(c.last)c.last(c);
			});
			//order?
			_.oneways.each(function(o) {o.draw()});
			
			_.show = true;
		},
		/**
		 * @method register the customize component or combinate with other charts
		 * @paramter <link>iChart.Custom</link><link>iChart.Chart</link>#object 
		 * @return void
		 */
		plugin : function(c) {
			var _ = this._();
			c.inject(_);
			if(c.ICHARTJS_CHART){
				c.Combination = true;
				c.setUp();
			}
			if(!_.get('animation')){
				c.push('animation',false);
			}
			c.duration =_.duration;
			_.register(c);
			_.plugins.push(c);
		},
		destroy:function(_){
			_.components.eachAll(function(C){
				C.destroy();
			});
			_.oneways.each(function(O){
				O.destroy();
			});
		},
		/**
		 * @method return the title,return undefined if unavailable
		 * @return <link>iChart.Text</link>#the title object
		 */
		getTitle:function(){
			return this.title;
		},
		/**
		 * @method return the subtitle,return undefined if unavailable
		 * @return <link>iChart.Text</link>#the subtitle object
		 */
		getSubTitle:function(){
			return this.subtitle;
		},
		/**
		 * @method return the footnote,return undefined if unavailable
		 * @return <link>iChart.Text</link>#the footnote object
		 */
		getFootNote:function(){
			return this.footnote;
		},
		/**
		 * @method return the main Drawing Area's dimension,return following property:
		 * x:the left-top coordinate-x
		 * y:the left-top coordinate-y
		 * width:the width of drawing area
		 * height:the height of drawing area
		 * @return Object#contains dimension info
		 */
		getDrawingArea:function(){
			return {
				x:this.get("l_originx"),
				x:this.get("t_originy"),
				width:this.get("client_width"),
				height:this.get("client_height")
			}
		},
		create : function(_,shell) {
			/**
			 * fit the window
			 */
			if(_.get('fit')){
				var w = window.innerWidth,
			    	h = window.innerHeight,
			    	style = $.getDoc().body.style;
			    style.padding = "0px";
			    style.margin = "0px";
			    style.overflow = "hidden";
			    _.push(_.W, w);
			    _.push(_.H, h);
			}
			
			_.canvasid = $.uid(_.type);
			_.shellid = "shell-"+_.canvasid;
			
			var H = [];
			H.push("<div id='");
			H.push(_.shellid);
			H.push("' style='padding:0px;margin:0px;overflow:hidden;position:relative;'>");
			H.push("<canvas id= '");
			H.push(_.canvasid);
			H.push("' style='-webkit-text-size-adjust: none;'>");
			H.push("<p>Your browser does not support the canvas element</p></canvas>");
			H.push("</div>");
			
			/**
			 * also use appendChild()
			 */
			shell.innerHTML = H.join("");
			
			_.shell = $(_.shellid);
			
			/**
			 * the base canvas wrap for draw
			 */
			_.T = _.target = new Cans(_.canvasid);
			
			/**
			 * do size
			 */
			_.size(_);
			_.Rendered = true;
		},
		/**
		 * @method set up the chart by latest configruation
		 * @return void
		 */
		setUp:function(){
			var _ = this._();
			_.redraw = false;
			_.T.clearRect();
			_.initialization = false;
			_.initialize();
		},
		/**
		 * @method load the new data
		 * @paramter array#data 
		 * @return void
		 */
		load:function(d){
			var _ = this._();
			_.push('data', d||[]);
			_.setUp();
			(_.Combination?_.root:_).draw();
		},
		/**
		 * @method resize the chart
		 * @paramter int#width 
		 * @paramter int#height 
		 * @return void
		 */
		resize:function(w,h){
			w = $.parseFloat(w);
			h = $.parseFloat(h);
			var _ = this._();
			if(!_.Combination){
				_.width = _.push(_.W, w);
				_.height = _.push(_.H, h);
				_.size(_);
			}
			_.set(_.fireEvent(_,'resize',[w,h]));
			_.setUp();
			_.plugins.eachAll(function(P) {
				if(P.Combination){
					P.resize(w,h);
				}
			});
			if(!_.Combination){
				_.draw();
			}
		},
		size:function(_){
			_.T.canvas.width = _.width = _.pushIf(_.W, 400);
			_.T.canvas.height = _.height = _.pushIf(_.H, 300);
			_.shell.style.width = _.width+'px';
			_.shell.style.height = _.height+'px';
		},
		initialize : function() {
			var _ = this._(),d = _.get('data'),r = _.get('render');
			
			_.push(_.X, null);
			_.push(_.Y, null);
			
			if(_.Combination){
				$.apply(_.options, $.clone([_.W,_.H,'padding','border','client_height','client_width',
				                                      'minDistance','maxDistance','centerx', 'centery',
				                                      'l_originx','r_originx','t_originy','b_originy'], _.root.options,true));
				_.width = _.get(_.W);
				_.height = _.get(_.H);
				_.shell = _.root.shell;
				_.Rendered = true;
			}else if (!_.Rendered) {
				if(r)
				_.create(_,$(r));
			}
			
			if(_.Rendered && !_.initialization){
				if(d&&d.length>0){
					parse.call(_,d,_);
				}else if($.isString(_.get('url'))){
					_.ajax.call(_,_.get('url'),function(D){
						_.push('data',D);
						_.initialize();
						_.draw();
					});
				}
			}
		},
		/**
		 * @method turn off the event listener
		 * @return void
		 */
		eventOff:function(){this.stopEvent = true},
		/**
		 * @method turn on the event listener
		 * @return void
		 */
		eventOn:function(){this.stopEvent = false},
		/**
		 * this method only invoked once
		 */
		oneWay:function(_){
			
			_.T.strokeStyle(true,0, _.get('strokeStyle'), _.get('lineJoin'));
			
			_.processAnimation = _.get('animation');
			
			if($.isFunction(_.get('doAnimation'))){
				_.doAnimation = _.get('doAnimation');
			}
			_.animationArithmetic = $.getAA(_.get('animation_timing_function'));
			
			var E = _.variable.event,comb=_.Combination,tot=!_.get('turn_off_touchmove')&&!comb, mCSS = !$.touch&&_.get('default_mouseover_css')&&!comb, O, AO,events = $.touch?['touchstart','touchmove']:['click','mousemove'];
			_.stopEvent = false;
			_.A_draw = comb&&_.processAnimation;
			
			/**
			 * register chart in Registry
			 */
			$.register(_);
			
			/**
			 * If Combination,ignore binding event because of root have been do this.
			 */
			if(!comb){
				events.each(function(it) {
					_.T.addEvent(it, function(e) {
						if (_.processAnimation||_.stopEvent)
							return;
						if(e.targetTouches&&e.targetTouches.length!=1){
							return;
						}
						_.fireEvent(_, it, [_, $.Event.fix(e)]);
					}, false);
				});
			}
			
			_.on(events[0], function(_, e) {
				_.components.eachAll(function(C) {
					if(C.ICHARTJS_CHART){
						/**
						 * meaning this component is a Combination Chart
						 */
						if(C.fireEvent(C,events[0], [C, e])){
							E.click = true;
							return false;
						}
					}else{
						/**
						 * generic component
						 */
						var M = C.isMouseOver(e);
						if (M.valid){
							E.click = true;
							C.fireEvent(C,'click', [C, e, M]);
							return !e.stopPropagation;
						}
					}
				});
				if(E.click){
					if(tot)
					e.event.preventDefault();
					E.click = false;
					return true;
				}
			});
			
			if(!$.touch||tot){
				_.on(events[1], function(_, e) {
					O = AO = false;
					_.components.eachAll(function(C) {
						if(C.ICHARTJS_CHART){
							/**
							 * meaning this component is a Combination Chart
							 */
							if(C.fireEvent(C,events[1], [C, e])){
								O = true;
								return false;
							}
						}else{
							var cE = C.variable.event, M = C.isMouseOver(e);
							if (M.valid) {
								O = O || C.atomic;
								if (!cE.mouseover) {
									cE.mouseover = true;
									C.fireEvent(C, 'mouseover', [C,e, M]);
								}
								C.fireEvent(C, 'mousemove', [C,e, M]);
								if(M.stop){
									return false;
								}
							} else {
								if (cE.mouseover) {
									cE.mouseover = false;
									C.fireEvent(C, 'mouseout', [C,e, M]);
								}
							}
							return !e.stopPropagation;
						}
					});
					if(E.mouseover){
						e.event.preventDefault();
						if (!O) {
							E.mouseover = false;
							_.fireEvent(_, 'mouseout', [_,e]);
						}
						return E.mouseover;
					}else{
						if(O){
							E.mouseover = O;
							_.fireEvent(_, 'mouseover', [_,e]);
						}
					}
				});
				/**
				 * defalut mouse style
				 */
				if (mCSS) {
					_.on('mouseover',function(){
						_.T.css("cursor", "pointer");
					}).on('mouseout',function(){
						_.T.css("cursor", "default");
					});
				}
			}
			/**
			 * clone config to sub_option
			 */
			$.applyIf(_.get('sub_option'), $.clone(['shadow','tip'], _.options,true));
			
			if(!_.Combination){
				/**
				 * push the background in it
				 */
				_.bg = new $.Custom({
					z_index:-1,
					drawFn:function(){
						_.T.box(0, 0, _.width, _.height, _.get('border'), _.get('f_color'),0,0,true);
					}
				});
				_.duration = ceil(_.get('animation_duration') * $.FRAME / 1000);
			}
			
			_.oneWay = $.emptyFn;
		},
		/**
		 * calculate chart's alignment
		 */
		originXY:function(_,x,y){
			var A = _.get('align');
			if (A == _.L) {
				_.pushIf(_.X, x[0]);
			} else if (A == _.R) {
				_.pushIf(_.X, x[1]);
			} else {
				_.pushIf(_.X, x[2]);
			}
			_.x = _.push(_.X, _.get(_.X) + _.get('offsetx'));
			_.y = _.push(_.Y, y[0]+ _.get('offsety'));
			
			return {
				x:_.x,
				y:_.y
			}
		},
		getPercent:function(v,T){
			return this.get('showpercent') ? (v / (T||this.total||1) * 100).toFixed(this.get('decimalsnum')) + '%' : v;
		},
		doActing:function(_,d,o,i,t){
			var f=!!_.get('communal_acting'),v=_.getPercent(d.value,d.total);
			/**
			 * store or restore the option
			 */
			_.push(f?'sub_option':'communal_acting',$.clone(_.get(f?'communal_acting':'sub_option'),true));
			/**
			 * merge the option
			 */
			$.merge(_.get('sub_option'),d);
			
			/**
			 * merge specific option
			 */
			$.merge(_.get('sub_option'),o);
			
			_.push('sub_option.value',v);
			_.push('sub_option.value_',d.value);
			
			if (_.get('sub_option.tip.enable')){
				_.push('sub_option.tip.text',t || (d.name + ' ' +v));
				_.push('sub_option.tip.name',d.name);
				_.push('sub_option.tip.index',i);
				_.push('sub_option.tip.value',d.value);
				_.push('sub_option.tip.total',d.total||_.total);
			}
		},
		register:function(c){
			c.id = $.uid(c.type);
			this.components.push(c);
			return c;
		},
		remove:function(_,c){
			if(c)
			_.components.each(function(C,i){
				if(c.id==C.id){
					_.components.splice(i,1);
					return false;
				}
			});
		},
		doConfig : function() {
			$.Chart.superclass.doConfig.call(this);
			var _ = this._();
			
			_.destroy(_);
			
			_.oneways.length =0;
			
			_.oneWay(_);
			
			/**
			 * for store the option of each item in chart
			 */
			_.push('communal_acting',0);
			
			if(!_.Combination){
				_.oneways.push(_.bg);
				_.push('r_originx', _.width - _.get('padding_right'));
				_.push('b_originy', _.height - _.get('padding_bottom'));
				
				_.applyGradient();
				
				if ($.isString(_.get('title'))) {
					_.push('title', $.applyIf({
						text : _.get('title')
					}, _.default_.title));
				}
				if ($.isString(_.get('subtitle'))) {
					_.push('subtitle', $.applyIf({
						text : _.get('subtitle')
					}, _.default_.subtitle));
				}
				
				if ($.isString(_.get('footnote'))) {
					_.push('footnote', $.applyIf({
						text : _.get('footnote')
					}, _.default_.footnote));
				}
				var H = 0, l = _.push('l_originx', _.get('padding_left')), t = _.push('t_originy', _.get('padding_top')), w = _.push('client_width', (_.width - _.get('hpadding'))), h;
				
				if (_.get('title.text') != ''){
					var st = _.get('subtitle.text') != '';
					H = st ? _.get('title.height') + _.get('subtitle.height') : _.get('title.height');
					t = _.push('t_originy', t + H);
					_.push('title.originx', l);
					_.push('title.originy', _.get('padding_top'));
					_.push('title.maxwidth', w);
					_.pushIf('title.width', w);
					_.title = new $.Text(_.get('title'), _);
					_.oneways.push(_.title);
					if (st) {
						_.push('subtitle.originx', l);
						_.push('subtitle.originy', _.get('padding_top') + _.get('title.height'));
						_.pushIf('subtitle.width', w);
						_.push('subtitle.maxwidth', w);
						_.subtitle = new $.Text(_.get('subtitle'), _);
						_.oneways.push(_.subtitle);
					}
				}
					
				if (_.get('footnote.text') != '') {
					var g = _.get('footnote.height');
					H += g;
					_.push('b_originy', _.get('b_originy') - g);
					_.push('footnote.originx', l);
					_.push('footnote.originy', _.get('b_originy'));
					_.push('footnote.maxwidth', w);
					_.pushIf('footnote.width', w);
					_.footnote = new $.Text(_.get('footnote'), _);
					_.oneways.push(_.footnote);
				}
				h = _.push('client_height', (_.get(_.H) - _.get('vpadding') - _.pushIf('other_height',H)));
				
				_.push('minDistance', min(w, h));
				_.push('maxDistance', max(w, h));
				_.push('centerx', l + w / 2);
				_.push('centery', t + h / 2);
			}
			
			/**
			 * TODO legend dosize?
			 */
			if (_.get('legend.enable')){
				_.legend = new $.Legend($.apply({
					maxwidth : _.get('client_width'),
					data : _.data
				}, _.get('legend')), _);
				_.oneways.push(_.legend);
			}
			
			_.push('sub_option.tip.wrap',_.push('tip.wrap', _.shell));
		}
	});
})(iChart);
/**
 * @end
 */

