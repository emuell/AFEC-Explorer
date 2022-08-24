import { css, html, LitElement, PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'

import * as d3 from "d3";

import { PlotEntry } from '../controllers/backend/plot';
import { playAudioFile } from '../controllers/backend/audio';

import { appState } from '../app-state';

// -------------------------------------------------------------------------------------------------

// A single point in the scatter plot based on the backends plot entry

export interface PlotDataPoint extends PlotEntry { 
  index: number;
  color: string; 
};

// -------------------------------------------------------------------------------------------------

// File map t-SNE scatter plot impl based on D3.

@customElement('afec-file-map-plot')
export class FileMapPlot extends LitElement {

  // Properties
  @property({type: Array}) 
  data: PlotEntry[] = [];  

  // Elements
  @query("#container")
  private _plotContainer!: HTMLDivElement | null;
  
  @query("#tooltip")
  private _toolTip!: HTMLDivElement | null;

  // Tools
  private _resizeObserver?: ResizeObserver = undefined;

  // Selections 
  private _plotSvg?: d3.Selection<SVGGElement, unknown, null, undefined> = undefined;
  private _plotCanvas?: d3.Selection<HTMLCanvasElement, unknown, null, undefined> = undefined;

  // Mutable state
  private _selectedPointIndex: number = -1;
  private _playingPointIndex: number = -1;
  private _zoomTransform = d3.zoomIdentity;
  
  // Consts
  private readonly pointRadius = 1;
  private readonly selectedPointRadius = 1.25;
  private readonly selectedPointColor = '#ff3585'
    
  private _currentPlotRect(): {
    left: number,
    top: number,
    outerWidth: number,
    outerHeight: number,
    innerWidth: number,
    innerHeight: number
  } {
    const rect = this.getBoundingClientRect();

    // allows nesting the canvas plot into e.g. some svg axis - currently unused 
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };

    const outerWidth = rect.width;
    const outerHeight = rect.height;
    const innerWidth = outerWidth - margin.left - margin.right;
    const innerHeight = outerHeight - margin.top - margin.bottom;

    return { top: margin.top, left: margin.left, 
      outerWidth, outerHeight, innerWidth, innerHeight };
  }

  private _findClosestPointInPlot(
    quadTree: d3.Quadtree<PlotDataPoint>, 
    event: any
  ) {
    const mouseX = this._zoomTransform.invertX(event.layerX || event.offsetX);
    const mouseY = this._zoomTransform.invertY(event.layerY || event.offsetY);
    const radius = 2 * this.selectedPointRadius;
    return quadTree.find(mouseX, mouseY, radius);
  }

  private _onMouseMove(quadTree: d3.Quadtree<PlotDataPoint>, event: any) {
    const closestPoint = this._findClosestPointInPlot(quadTree, event);
    if (closestPoint) {
      // Show the tooltip only when there is nodeData found by the mouse
      d3.select(this._toolTip!)
        .style('opacity', 0.8)
        .style('top', event.pageY + 5 + 'px')
        .style('left', event.pageX + 5 + 'px')
        .html(`File: ${closestPoint.filename}<br>` + 
          `Class: ${closestPoint.classes.join(",")}<br>` + 
          `Categories: ${closestPoint.categories.join(",")}`);
      // Play the file
      if (appState.autoPlayFiles && this._playingPointIndex != closestPoint.index) {
        this._playingPointIndex = closestPoint.index;
        playAudioFile(appState.databasePath, closestPoint.filename)
          .catch((err) => { 
            console.log("Audio playback failed: %s", err)
          });
      }
    } else {
      // Hide the tooltip when there our mouse doesn't find nodeData
      d3.select(this._toolTip!)
        .style('opacity', 0);
    }
  }
  
  private _onMouseClick(
    quadTree: d3.Quadtree<PlotDataPoint>, 
    data: PlotDataPoint[],
    event: any, 
    xScale: d3.ScaleLinear<number, number, never>, 
    yScale: d3.ScaleLinear<number, number, never>, 
    context: CanvasRenderingContext2D, 
  ) {
    const closestPoint = this._findClosestPointInPlot(quadTree, event);
    if (closestPoint) {
      if (this._selectedPointIndex != closestPoint.index) {
        this._selectedPointIndex = closestPoint.index;
        // redraw all points
        this._drawPlotPoints(xScale, yScale, context, data);
        // play file
        playAudioFile(appState.databasePath, closestPoint.filename)
          .catch((err) => { 
            console.log("Audio playback failed: %s", err)
          });
      }
    } else {
      if (this._selectedPointIndex != -1) {
        this._selectedPointIndex = -1;
        // redraw all points
        this._drawPlotPoints(xScale, yScale, context, data);
      }
    }
  }
  
  private _drawPlotPoints(
    xScale: d3.ScaleLinear<number, number, never>, 
    yScale: d3.ScaleLinear<number, number, never>, 
    context: CanvasRenderingContext2D, 
    data: PlotDataPoint[], 
  ) {
    context.save();

    const scaleX = this._zoomTransform.rescaleX(xScale);
    const scaleY = this._zoomTransform.rescaleY(yScale);
    const k = this._zoomTransform.k;

    const plotRect = this._currentPlotRect();
    context.clearRect(0, 0, plotRect.innerWidth, plotRect.innerHeight);

    data.forEach((point: PlotDataPoint) => {
      const isSelected = (this._selectedPointIndex == point.index);
      const radius = (isSelected ? this.selectedPointRadius : this.pointRadius) * k;
      const color = isSelected ? this.selectedPointColor : point.color;
      context.beginPath();
      context.fillStyle = color;
      const px = scaleX(point.x);
      const py = scaleY(point.y);
      context.arc(px, py, 1.2 * radius, 0, 2 * Math.PI, true);
      context.fill();
    });

    context.restore();
  }

  private _createPlot(data: Array<PlotDataPoint>) {
    const initialRect = this._currentPlotRect();
    const container = d3.select(this._plotContainer!);
   
    // reset state
    this._selectedPointIndex = -1;
    this._zoomTransform = d3.zoomIdentity;

    // Create SVG node
    this._plotSvg = container
      .append('svg:svg')
      .attr('width', initialRect.outerWidth)
      .attr('height', initialRect.outerHeight)
      .style('position', 'absolute')
      .attr('class', 'svg-plot')
      .append('g')
      .attr('transform', `translate(${initialRect.left}, ${initialRect.top})`);

    // Create Canvas overlay
    this._plotCanvas = container
      .append('canvas')
      .attr('width', initialRect.innerWidth)
      .attr('height', initialRect.innerHeight)
      .style('margin-left', initialRect.left + 'px')
      .style('margin-top', initialRect.top + 'px')
      .style('position', 'absolute')
      .attr('class', 'canvas-plot');

    // Track and forward size changes to SVG and Canvas
    this._resizeObserver = new ResizeObserver(() => {
      if (this._plotSvg && this._plotCanvas && context) {
        // update canvas and svg size
        const newRect = this._currentPlotRect();
        this._plotSvg
          .attr('width', newRect.outerWidth)
          .attr('height', newRect.outerHeight)
          .attr('transform', `translate(${newRect.left}, ${newRect.top})`);
        this._plotCanvas
          .attr('width', newRect.innerWidth)
          .attr('height', newRect.innerHeight)
          .style('margin-left', newRect.left + 'px')
          .style('margin-top', newRect.top + 'px');
        // redraw all points
        this._drawPlotPoints(xScale, yScale, context, data);
      }
    });
    this._resizeObserver.observe(this);

    // Init Scales
    const xScale = d3.scaleLinear()
      .domain([d3.min(data, (d: any) => d.x), d3.max(data, (d: any) => d.x)])
      .range([0, initialRect.innerWidth])
      .nice();
    const yScale = d3.scaleLinear()
      .domain([d3.min(data, (d: any) => d.y), d3.max(data, (d: any) => d.y)])
      .range([initialRect.innerHeight, 0])
      .nice();
  
    // Create drawing context
    const context = this._plotCanvas.node()!.getContext('2d')!;

    // Create a quadtree for fast hit detection
    const quadTree = d3.quadtree<PlotDataPoint>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .addAll(data);

    // Add MouseOver and click handlers
    this._plotCanvas
      .on('mousemove', (event) => {
        this._onMouseMove(quadTree, event);
      })
      .on('click', (event) => {
        this._onMouseClick(quadTree, data, event, xScale , yScale, context);
      });

    // Add Zoom/Drag handler
    const zoomHandler = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 1000])
      .on('zoom', (event) => {
        this._zoomTransform = event.transform;
        this._drawPlotPoints(xScale, yScale, context, data);
      });
    this._plotCanvas.call(zoomHandler);
  
    // Draw initial content
    this._drawPlotPoints(xScale, yScale, context, data);
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    // clear all previous content - if any
    if (this._plotSvg && this._plotCanvas) {
      this._plotSvg.remove();
      this._plotSvg = undefined;
      this._plotCanvas.remove();
      this._plotCanvas = undefined;
    }

    // remove existing resize observers
    if (this._resizeObserver) {
      this._resizeObserver.unobserve(this);
      this._resizeObserver = undefined;
    }

    // render a new plot
    const categoryNames = appState.databaseCategoryNames;
    const colorScheme = d3.schemeCategory10;
    
    const data: Array<PlotDataPoint> = this.data.map((v, i) => {
      let color: string = "#fff";
      const mainCategory = v.categories.length ? v.categories[0] : "";
      if (mainCategory !== "") {
        let index = categoryNames.indexOf(mainCategory);
        if (index !== -1) {
          color = colorScheme[Math.trunc(index % colorScheme.length - 1)];
        }
      }
      return {...v, index: i, color: color}
    });

    this._createPlot(data);
  }

  static styles = css`
    #tooltip {
		  position: absolute;        
			display: inline-block;
			padding: 10px;
			background-color: #000;
		  color: #fff;
			border: 1px solid #999;
			border-radius: 2px;
		  pointer-events: none;
			opacity: 0;
			z-index: 1;
		}
  `;

  render() {
    return html`
      <div id="container" style="width: 100%; height: 100%;"></div>
      <div id="tooltip"></div>`
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-file-map-plot': FileMapPlot
  }
}
