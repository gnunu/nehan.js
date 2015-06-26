var FloatGenerator = (function(){
  /**
   * [caution]<br>
   * constructor argument 'style' is the style of <b>parent</b>.<br>
   * so if &lt;body&gt;&lt;float1&gt;..&lt;/float1&gt;&lt;float2&gt;...&lt;/float2&gt;&lt;/body&gt;,<br>
   * style of this contructor is 'body.style'

     @memberof Nehan
     @class FloatGenerator
     @classdesc generator of float layout
     @constructor
     @param style {Nehan.StyleContext}
     @param stream {Nehan.TokenStream}
     @param floated_generators {Array.<Nehan.LayoutGenerator>} - continuous floated generator collection
  */
  function FloatGenerator(style, stream, floated_generators){
    BlockGenerator.call(this, style, stream);
    this.generators = floated_generators;

    // create child generator to yield rest-space of float-elements with logical-float "start".
    // notice that this generator uses 'clone' of original style, because content size changes by position,
    // but on the other hand, original style is referenced by float-elements as their parent style.
    // so we must keep original style immutable.
    this.setChildLayout(new BlockGenerator(style.clone({"float":"start"}), stream));
  }
  Nehan.Class.extend(FloatGenerator, LayoutGenerator);

  /**
     @memberof Nehan.FloatGenerator
     @return {boolean}
  */
  FloatGenerator.prototype.hasNext = function(){
    if(this._terminate){
      return false;
    }
    return this._hasNextFloat() || this.hasCache();
  };

  FloatGenerator.prototype._hasNextFloat = function(){
    return Nehan.List.exists(this.generators, function(gen){
      return gen.hasNext();
    });
  };

  FloatGenerator.prototype._yield = function(context){
    var stack = this._yieldFloatStack(context);
    var rest_measure = context.getInlineRestMeasure();
    var rest_extent = stack.getExtent();
    var root_measure = rest_measure;
    if(rest_measure <= 0 || rest_extent <= 0){
      return null;
    }
    return this._yieldFloat(context, stack, root_measure, rest_measure, rest_extent);
  };

  FloatGenerator.prototype._yieldFloat = function(context, stack, root_measure, rest_measure, rest_extent){
    //console.log("_yieldFloat(root_m:%d, rest_m:%d, rest_e:%d)", root_measure, rest_measure, rest_extent);

    if(rest_measure <= 0){
      return null;
    }

    // no more floated layout, just yield rest area.
    if(stack.isEmpty()){
      return this._yieldFloatSpace(context, rest_measure, rest_extent);
    }
    /*
      <------ rest_measure ---->
      --------------------------
      |       |                |
      | group | rest           | => group_set(wrap_float)
      |       |                |
      --------------------------
    */
    var flow = this.style.flow;
    var group = stack.pop(); // pop float group(notice that this stack is ordered by extent asc, so largest one is first obtained).
    var rest_rest_measure = rest_measure - group.getMeasure(flow); // rest of 'rest measure'
    var rest = this._yieldFloat(context, stack, root_measure, rest_rest_measure, group.getExtent(flow)); // yield rest area of this group in inline-flow(recursive).
    var group_set = this._wrapFloat(group, rest, rest_measure); // wrap these 2 floated layout as one block.

    /*
      To understand rest_extent_space, remember that this func is called recursivelly,
      and argument 'rest_extent' is generated by 'previous' largest float group(g2).
      
      <--- rest_measure --->
      ----------------------------
      |    |                |    |
      | g1 | rest           | g2 |
      |    |                |    |
      ----------------------|    |
      |  rest_extent_space  |    |
      ----------------------------
    */
    var rest_extent_space = rest_extent - group.getExtent(flow);

    // if no more rest extent is left, continuous layout is displayed in context of parent generator.
    if(rest_extent_space <= 0){
      if(!this.hasNext()){
	// before: [root] -> [float(this)] -> [root(clone)] -> [child]
	//  after: [root] -> [child]
	var root = this._parent;
	var root_clone = this._child;
	var root_child = root_clone._child || null;
	if(root_child){
	  root_child._parent = root;
	  root_child.style.forceUpdateContextSize(root_measure, root.style.contentExtent);
	}
	root._child = root_child;
	root._cachedElements = root_clone._cachedElements || [];
      }
      return group_set;
    }

    /*
      <------ rest_measure ---->
      --------------------------
      |       |                |
      | group | rest           | => group_set(wrap_float)
      |       |                |
      --------------------------
      |  rest_extent_space     | => rest_extent - group_set.extent
      --------------------------
    */
    // if there is space in block-flow direction, yield rest space and wrap tfloated-set and rest-space as one.
    var space = this._yieldFloatSpace(context, rest_measure, rest_extent_space);
    return this._wrapBlocks([group_set, space]);
  };
  
  FloatGenerator.prototype._sortFloatRest = function(floated, rest){
    var floated_elements = floated.getElements();
    var elements = floated.isFloatStart()? floated_elements.concat(rest) : [rest].concat(floated_elements);
    return Nehan.List.filter(elements, function(element){ return element !== null; });
  };

  FloatGenerator.prototype._wrapBlocks = function(blocks){
    var flow = this.style.flow;
    var elements = Nehan.List.filter(blocks, function(block){ return block !== null; });
    var measure = elements[0].getLayoutMeasure(flow); // block1 and block2 has same measure
    var extent = Nehan.List.sum(elements, 0, function(element){ return element.getLayoutExtent(flow); });
    var break_after = Nehan.List.exists(elements, function(element){ return element.breakAfter; });

    // wrapping block always float to start direction
    return this.style.createChild("div", {"float":"start", measure:measure}).createBlock({
      elements:elements,
      breakAfter:break_after,
      extent:extent
    });
  };

  FloatGenerator.prototype._wrapFloat = function(floated, rest, measure){
    var flow = this.style.flow;
    var extent = floated.getExtent(flow);
    var elements = this._sortFloatRest(floated, rest || null);
    var break_after = Nehan.List.exists(elements, function(element){ return element.breakAfter; });
    return this.style.createChild("div", {"float":"start", measure:measure}).createBlock({
      elements:elements,
      breakAfter:break_after,
      extent:extent
    });
  };
  
  FloatGenerator.prototype._yieldFloatSpace = function(context, measure, extent){
    //console.log("yieldFloatSpace(c = %o, m = %d, e = %d)", context, measure, extent);
    this._child.style.forceUpdateContextSize(measure, extent);
    return this.yieldChildLayout();
  };
  
  FloatGenerator.prototype._yieldFloatStack = function(context){
    var start_blocks = [], end_blocks = [];
    Nehan.List.iter(this.generators, function(gen){
      var block = gen.yield(context);
      if(block){
	if(gen.style.isFloatStart()){
	  start_blocks.push(block);
	} else if(gen.style.isFloatEnd()){
	  end_blocks.push(block);
	}
      }
    });
    return new Nehan.FloatGroupStack(this.style.flow, start_blocks, end_blocks);
  };

  return FloatGenerator;
})();

