Nehan.FloatGroupStack = (function(){

  // [float block] -> FloatGroup
  var __pop_float_group = function(flow, float_direction, blocks){
    var head = blocks.pop() || null;
    if(head === null){
      return null;
    }
    var extent = head.getLayoutExtent(flow);
    var group = new Nehan.FloatGroup([head], float_direction);

    // group while previous floated-element has smaller extent than the head
    while(true){
      var next = blocks.pop();
      if(next && next.getLayoutExtent(flow) <= extent){
	group.add(next);
      } else {
	blocks.push(next); // push back
	break;
      }
    }
    return group;
  };

  // [float block] -> [FloatGroup]
  var __make_float_groups = function(flow, float_direction, blocks){
    var ret = [], group;
    do{
      group = __pop_float_group(flow, float_direction, blocks);
      if(group){
	ret.push(group);
      }
    } while(group !== null);
    return ret;
  };

  /**
     @memberof Nehan
     @class FloatGroupStack
     @classdesc pop {@link Nehan.FloatGroup} with larger extent from start or end.
     @constructor
     @param flow {Nehan.BoxFlow}
     @param start_blocks {Array.<Nehan.Box>}
     @param end_blocks {Array.<Nehan.Box>}
  */
  function FloatGroupStack(flow, start_blocks, end_blocks){
    var start_groups = __make_float_groups(flow, Nehan.FloatDirections.get("start"), start_blocks);
    var end_groups = __make_float_groups(flow, Nehan.FloatDirections.get("end"), end_blocks);
    this.flow = flow;
    this.stack = start_groups.concat(end_groups).sort(function(g1, g2){
      return g1.getExtent(flow) - g2.getExtent(flow);
    });
    this.maxGroup = Nehan.List.maxobj(this.stack, function(group){
      return group.getExtent(flow);
    });
    //console.log("max group from %o is %o", this.stack, max_group);
    this.extent = 0;
    this.lastStartExtent = 0;
    this.lastEndExtent = 0;
    if(this.maxGroup){
      this.extent = this.maxGroup.getExtent(flow);
      this._updateLastExtent(this.maxGroup);
    }
  }

  FloatGroupStack.prototype = {
    _updateLastExtent : function(group){
      var prop = group.isFloatStart()? "lastStartExtent" : "lastEndExtent";
      var extent = group.getExtent(this.flow);
      this[prop] = extent;
    },
    /**
     @memberof Nehan.FloatGroupStack
     @return {boolean}
     */
    isEmpty : function(){
      return this.stack.length === 0;
    },
    /**
     @memberof Nehan.FloatGroupStack
     @return {int}
     */
    getExtent : function(){
      return this.extent;
    },
    /**
     @memberof Nehan.FloatGroupStack
     @return {int}
     */
    getLastStartExtent : function(){
      return this.lastStartExtent;
    },
    /**
     @memberof Nehan.FloatGroupStack
     @return {int}
     */
    getLastEndExtent : function(){
      return this.lastEndExtent;
    },
    /**
     pop {@link Nehan.FloatGroup} with larger extent from start or end.

     @memberof Nehan.FloatGroupStack
     @return {Nehan.FloatGroup}
     */
    pop : function(){
      var group = this.stack.pop() || null;
      if(group){
	this._updateLastExtent(group);
      }
      return group
    }
  };

  return FloatGroupStack;
})();

