import { css, html, LitElement, PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { WaveformPoint } from '../controllers/backend/waveform';

import * as d3 from "d3";

// -------------------------------------------------------------------------------------------------

// File waveform view based on D3.

@customElement('afec-file-waveview-plot')
export class FileWaveViewPlot extends LitElement {

  // Properties
  @property({type: Array}) 
  data: WaveformPoint[] = [];  

  // Elements
  @query("#waveform-container")
  private _waveformContainer!: HTMLDivElement | null;
  
  // Tools
  private _resizeObserver?: ResizeObserver = undefined;

  // Selections 
  private _waveformSvg?: d3.Selection<SVGGElement, unknown, null, undefined> = undefined;
  private _waveformCanvas?: d3.Selection<HTMLCanvasElement, unknown, null, undefined> = undefined;

  // Mutable state
  // private _playingPosition: number = -1;
  private _zoomTransform = d3.zoomIdentity;
  
  // Consts
  private readonly waveformColor = '#ff3585'
    
  private _currentPlotRect(): {
    left: number,
    top: number,
    outerWidth: number,
    outerHeight: number,
    innerWidth: number,
    innerHeight: number
  } {
    const rect = this.getBoundingClientRect();

    // nest the waveform plot into axis
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };

    const outerWidth = rect.width;
    const outerHeight = rect.height;
    const innerWidth = outerWidth - margin.left - margin.right;
    const innerHeight = outerHeight - margin.top - margin.bottom;

    return { top: margin.top, left: margin.left, 
      outerWidth, outerHeight, innerWidth, innerHeight };
  }

  private _onMouseClick(
    _data: WaveformPoint[],
    _event: any, 
    _xScale: d3.ScaleLinear<number, number, never>, 
    _yScale: d3.ScaleLinear<number, number, never>, 
    _context: CanvasRenderingContext2D, 
  ) {
    // TODO
  }
  
  private _drawPlotPoints(
    xScale: d3.ScaleLinear<number, number, never>, 
    yScale: d3.ScaleLinear<number, number, never>, 
    context: CanvasRenderingContext2D, 
    data: WaveformPoint[],
  ) {
    context.save();

    const scaleX = this._zoomTransform.rescaleX(xScale);
    const scaleY = this._zoomTransform.rescaleY(yScale);

    const plotRect = this._currentPlotRect();
    context.clearRect(0, 0, plotRect.innerWidth, plotRect.innerHeight);

    context.beginPath();
    context.lineWidth = 1;
    context.strokeStyle = this.waveformColor;
    
    if (data.length) {
      const x = scaleX(0);
      const minY = scaleY(data[0].min);
      context.moveTo(x, minY);
    }
    
    data.forEach(point => {
      const x = scaleX(point.time);
      const minY = scaleY(point.min);
      context.lineTo(x, minY);
      const maxY = scaleY(point.max);
      context.lineTo(x, maxY);
    });

    context.stroke();

    context.restore();
  }

  private _createWaveform(data: Array<WaveformPoint>) {
    const initialRect = this._currentPlotRect();
    const container = d3.select(this._waveformContainer!);
   
    // reset state
    this._zoomTransform = d3.zoomIdentity;

    // Init Scales
    let xScale = d3.scaleLinear()
      .domain([0, data.length])
      .range([0, initialRect.innerWidth]);
    
    let topBottomMargin = 0;
    let yScale = d3.scaleLinear()
      .domain([d3.min(data, (d: any) => d.min), d3.max(data, (d: any) => d.max)])
      .range([topBottomMargin, initialRect.innerHeight - topBottomMargin]);
  
    // Create SVG node
    this._waveformSvg = container
      .append('svg:svg')
      .attr('width', initialRect.outerWidth)
      .attr('height', initialRect.outerHeight)
      .style('position', 'absolute')
      .attr('class', 'svg-plot')
      .append('g')
      .attr('transform', `translate(${initialRect.left}, ${initialRect.top})`);

    /* axis: TODO
    const xAxis = d3.axisBottom(xScale).ticks(initialRect.innerWidth / 100, ".2f");
    const yAxis = d3.axisLeft(yScale).ticks(4, ".2f");

    this._waveformSvg.append("g")
      .attr("transform", `translate(0,${initialRect.innerHeight})`)
      .call(xAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
          .attr("y2", initialRect.top - initialRect.innerHeight)
          .attr("stroke-opacity", 0.1)
      )
      .call(g => g.append("text")
          .attr("x", initialRect.innerWidth)
          .attr("y", -4)
          .attr("fill", "currentColor")
          .attr("text-anchor", "end")
      );

    this._waveformSvg.append("g")
      .attr("transform", `translate(${initialRect.left},0)`)
      .call(yAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
          .attr("x2", initialRect.innerWidth - initialRect.left)
          .attr("stroke-opacity", 0.1)
      )
      .call(g => g.append("text")
          .attr("x", -initialRect.left)
          .attr("y", 10)
          .attr("fill", "currentColor")
          .attr("text-anchor", "start")
      );
    */

    // Create Canvas overlay
    this._waveformCanvas = container
      .append('canvas')
      .attr('width', initialRect.innerWidth)
      .attr('height', initialRect.innerHeight)
      .style('margin-left', initialRect.left + 'px')
      .style('margin-top', initialRect.top + 'px')
      .style('position', 'absolute')
      .attr('class', 'canvas-plot');

    // Create drawing context
    const context = this._waveformCanvas.node()!.getContext('2d')!;

    // Add click handler
    this._waveformCanvas
      .on('click', (event) => {
        this._onMouseClick(data, event, xScale , yScale, context);
      });

    // Draw initial content
    this._drawPlotPoints(xScale, yScale, context, data);

    // Track and forward size changes to SVG and Canvas
    this._resizeObserver = new ResizeObserver(() => {
      if (this._waveformSvg && this._waveformCanvas && context) {
        // update canvas and svg size
        const newRect = this._currentPlotRect();
        this._waveformSvg
          .attr('width', newRect.outerWidth)
          .attr('height', newRect.outerHeight)
          .attr('transform', `translate(${newRect.left}, ${newRect.top})`);
        this._waveformCanvas
          .attr('width', newRect.innerWidth)
          .attr('height', newRect.innerHeight)
          .style('margin-left', newRect.left + 'px')
          .style('margin-top', newRect.top + 'px');
        
          // recalculate scales
        xScale = d3.scaleLinear()
          .domain([0, d3.max(data, (d: any) => d.time)])
          .range([0, newRect.innerWidth]);
        yScale = d3.scaleLinear()
          .domain([d3.min(data, (d: any) => d.min), d3.max(data, (d: any) => d.max)])
          .range([topBottomMargin, newRect.innerHeight - topBottomMargin]); 
        
          // redraw all points
        this._drawPlotPoints(xScale, yScale, context, data);
      }
    });
    this._resizeObserver.observe(this);
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    // clear all previous content - if any
    if (this._waveformSvg && this._waveformCanvas) {
      this._waveformSvg.remove();
      this._waveformSvg = undefined;
      this._waveformCanvas.remove();
      this._waveformCanvas = undefined;
    }

    // remove existing resize observers
    if (this._resizeObserver) {
      this._resizeObserver.unobserve(this);
      this._resizeObserver = undefined;
    }

    // render waveform
    this._createWaveform(this.data);
  }

  static styles = css`
    #waveform-container {
			width: 100%; 
      height: 100%;
		}
    #playback-container {
		  position: absolute;        
			display: inline-block;
		  pointer-events: none;
			z-index: 1;
		}
  `;

  render() {
    return html`
      <div id="waveform-container"></div>
      <div id="playback-container"></div>`
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-file-waveview-plot': FileWaveViewPlot
  }
}
