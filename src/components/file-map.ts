import { css, html, LitElement, PropertyValues } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx'

import * as d3 from "d3";

import { appState } from '../app-state';

// import { MapResult } from '../models/map-result';

import './error-message';
import './spinner';

// -------------------------------------------------------------------------------------------------

// A single point in the TSNE scatter plot

interface PlotDataPoint { 
  x: number; 
  y: number;
  index: number; 
};

// -------------------------------------------------------------------------------------------------

// File map TSNE scatter plot impl based on D3.

@customElement('afec-tsne-plot')
export class TSNEPlot extends LitElement {

  // @property() 
  // private mapData: MapResult[] = [];  

  // Elements
  @query("#container")
  private _plotContainer!: HTMLDivElement | null;
  
  @query("#tooltip")
  private _toolTip!: HTMLDivElement | null;

  // Tools
  private _resizeObserver?: ResizeObserver;

  // Selections 
  private _plotSvg?: d3.Selection<SVGGElement, unknown, null, undefined> = undefined;
  private _plotCanvas?: d3.Selection<HTMLCanvasElement, unknown, null, undefined> = undefined;

  // Mutable state
  private _selectedPointIndex: number = -1;
  private _zoomTransform = d3.zoomIdentity;
  
  // Consts
  private readonly pointRadius = 1;
  private readonly selectedPointRadius = 1.25;

  private readonly pointColor = '#3585ff'
  private readonly selectedPointColor = '#ff3585'
    
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    // clear all previous content - if any
    if (this._plotContainer && this._plotSvg && this._plotCanvas) {
      this._plotContainer.removeChild(this._plotSvg.node()!);
      this._plotSvg = undefined;
     
      this._plotContainer.removeChild(this._plotCanvas.node()!);
      this._plotCanvas = undefined;
    }

    // remove existing resize observers
    if (this._resizeObserver) {
      this._resizeObserver.unobserve(this);
      this._resizeObserver = undefined;
    }

    // render a new plot
    let data: Array<PlotDataPoint> = [];
    for (let i = 0; i < 10000; i++) {
      const x = Math.floor(Math.random() * 999999) + 1;
      const y = Math.floor(Math.random() * 999999) + 1;
      data.push({x, y, index: i});
    }

    this.createPlot(data);
  }

  private currentPlotRect(): {
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

  private findClosestPointInPlot(
    quadTree: d3.Quadtree<PlotDataPoint>, 
    event: any
  ) {
    const mouseX = this._zoomTransform.invertX(event.layerX || event.offsetX);
    const mouseY = this._zoomTransform.invertY(event.layerY || event.offsetY);
    const radius = 2 * this.selectedPointRadius;
    return quadTree.find(mouseX, mouseY, radius);
  }

  private onMouseMove(quadTree: d3.Quadtree<PlotDataPoint>, event: any) {
    const closestPoint = this.findClosestPointInPlot(quadTree, event);
    if (closestPoint) {
      // Show the tooltip only when there is nodeData found by the mouse
      d3.select(this._toolTip!)
        .style('opacity', 0.8)
        .style('top', event.pageY + 5 + 'px')
        .style('left', event.pageX + 5 + 'px')
        .html(`Point: ${closestPoint.index}`);
    } else {
      // Hide the tooltip when there our mouse doesn't find nodeData
      d3.select(this._toolTip!)
        .style('opacity', 0);
    }
  }
  
  private onMouseClick(
    quadTree: d3.Quadtree<PlotDataPoint>, 
    data: PlotDataPoint[],
    event: any, 
    xScale: d3.ScaleLinear<number, number, never>, 
    yScale: d3.ScaleLinear<number, number, never>, 
    context: CanvasRenderingContext2D, 
  ) {
    const closestPoint = this.findClosestPointInPlot(quadTree, event);
    if (closestPoint) {
      if (this._selectedPointIndex != closestPoint.index) {
        this._selectedPointIndex = closestPoint.index;
        // redraw all points
        this.drawPlotPoints(xScale, yScale, context, data);
      }
    } else {
      if (this._selectedPointIndex != -1) {
        this._selectedPointIndex = -1;
        // redraw all points
        this.drawPlotPoints(xScale, yScale, context, data);
      }
    }
  }
  
  private drawPlotPoints(
    xScale: d3.ScaleLinear<number, number, never>, 
    yScale: d3.ScaleLinear<number, number, never>, 
    context: CanvasRenderingContext2D, 
    data: PlotDataPoint[], 
  ) {
    context.save();

    const scaleX = this._zoomTransform.rescaleX(xScale);
    const scaleY = this._zoomTransform.rescaleY(yScale);
    const k = this._zoomTransform.k;

    const plotRect = this.currentPlotRect();
    context.clearRect(0, 0, plotRect.innerWidth, plotRect.innerHeight);

    data.forEach((point: PlotDataPoint) => {
      const isSelected = (this._selectedPointIndex == point.index);
      const radius = (isSelected ? this.selectedPointRadius : this.pointRadius) * k;
      const color = isSelected ? this.selectedPointColor : this.pointColor;
      context.beginPath();
      context.fillStyle = color;
      const px = scaleX(point.x);
      const py = scaleY(point.y);
      context.arc(px, py, 1.2 * radius, 0, 2 * Math.PI, true);
      context.fill();
    });

    context.restore();
  }

  private createPlot(data: Array<PlotDataPoint>) {
    const initialRect = this.currentPlotRect();
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
      if (this._plotSvg && this._plotCanvas) {
        // update canvas and svg size
        const newRect = this.currentPlotRect();
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
        this.drawPlotPoints(xScale, yScale, context, data);
      }
    });
    this._resizeObserver.observe(this);

    // Init Scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, (d: any) => d.x)])
      .range([0, initialRect.innerWidth])
      .nice();
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, (d: any) => d.y)])
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
        this.onMouseMove(quadTree, event);
      })
      .on('click', (event) => {
        this.onMouseClick(quadTree, data, event, xScale , yScale, context);
      });

    // Add Zoom/Drag handler
    const zoomHandler = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 1000])
      .on('zoom', (event) => {
        this._zoomTransform = event.transform;
        this.drawPlotPoints(xScale, yScale, context, data);
      });
    this._plotCanvas.call(zoomHandler);
  
    // Draw initial content
    this.drawPlotPoints(xScale, yScale, context, data);
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

// Map layout.

@customElement('afec-file-map')
export class FileMap extends MobxLitElement {

  @state()
  private _fetchError: string = "";

  // @state() 
  // private _mapEntries: MapResult[] = [];  

  constructor() {
    super();

    // fetch new map on database path changes, snapshot or root dir changes
    mobx.reaction(
      () => appState.databasePath,
      () => this._fetchMap(),
      { fireImmediately: true }
    );
  }

  private _fetchMap() {
    /*if (! appState.databasePath) {
      this._fetchError = "No database selected";
      this._mapEntries = [];
      return;
    }
    appState.fetchMap()
      .then((entries) => {
        // assign and rebuild graph
        this._mapEntries = [];
        if (this._canvas) {
          this._canvas.clearCache();
        }
        // reset fetch errors - if any
        this._fetchError = "";
      })
      .catch((error) => {
        this._fetchError = error.message || String(error);
        this._mapEntries = [];
      })*/
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }
    #header {
      align-items: center; 
      background: var(--lumo-shade-10pct);
      padding: 4px;
    }
    #header #title {
      flex: 1;
      margin: 0px 10px;
      padding: 4px 0px;
     }
    #loading {
      height: 100%; 
      align-items: center;
      justify-content: center;
    }
    #graph {
      flex: 1 1 auto;
    }
  `;

  render() {
    const header = html`
      <vaadin-horizontal-layout id="header">
        <strong id="title">Map</strong>
      </vaadin-horizontal-layout>
    `;
    // error
    if (this._fetchError && appState.isGeneratingMap === 0) {
      let errorMessage = this._fetchError;
      if (appState.databasePath) {
        errorMessage = "Failed to calculate t-SNE map: " + errorMessage;
      }
      return html`
        ${header}
        <afec-error-message 
          type=${appState.databasePath ? "error" : "info"}
          message=${errorMessage}>
        </afec-error-message>
      `;
    }
    // loading
    if (appState.isGeneratingMap > 0 || appState.isLoadingFiles > 0) {
      return html`
        ${header}
        <vaadin-horizontal-layout id="loading">
          <afec-spinner size="24px"></afec-spinner>
        </vaadin-horizontal-layout>
      `;
    }
    // map
    return html`
      ${header}
      <afec-tsne-plot id="graph"></afec-tsne-plot>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-file-map': FileMap
  }
}
