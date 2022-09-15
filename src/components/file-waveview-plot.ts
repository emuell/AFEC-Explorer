import { css, html, LitElement, PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { WaveformPoint } from '../controllers/backend/waveform';

import path from 'path-browserify';
import * as d3 from "d3";

import { addPlaybackFinishedEventListener, addPlaybackPositionEventListener } 
  from '../controllers/backend/audio';
  
import { appState } from '../app-state';

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
 @query("#playback-container")
  private _playbackContainer!: HTMLDivElement | null; 

  // Tools
  private _resizeObserver?: ResizeObserver = undefined;
  private _removePlaybackPositionListener?: () => void = undefined;
  private _removePlaybackFinishedListener?: () => void = undefined;

  // Selections 
  private _waveformSvg?: d3.Selection<SVGGElement, unknown, null, undefined> = undefined;
  private _waveformCanvas?: d3.Selection<HTMLCanvasElement, unknown, null, undefined> = undefined;
  private _playbackSvg?: d3.Selection<SVGGElement, unknown, null, undefined> = undefined;
  private _playbackCanvas?: d3.Selection<HTMLCanvasElement, unknown, null, undefined> = undefined;

  // Mutable state
  // private _playingPosition: number = -1;
  private _zoomTransform = d3.zoomIdentity;
  
  // Consts
  private readonly waveformColor = '#ff3585'
  private readonly playbackPosColor = '#ffffff'
    
  private _currentPlotRect(): {
    left: number,
    right: number,
    top: number,
    bottom: number,
    outerWidth: number,
    outerHeight: number,
    innerWidth: number,
    innerHeight: number
  } {
    const rect = this.getBoundingClientRect();

    // nest the waveform plot into axis
    const margin = { top: 0, right: 0, bottom: 10, left: 0 };

    const outerWidth = rect.width;
    const outerHeight = rect.height;
    const innerWidth = outerWidth - margin.left - margin.right;
    const innerHeight = outerHeight - margin.top - margin.bottom;

    return { left: margin.left, right: margin.right, top: margin.top, bottom: margin.bottom, 
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
  
  private _drawWaveform(
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

  private _drawPlaybackPosition(
    xScale: d3.ScaleLinear<number, number, never>, 
    yScale: d3.ScaleLinear<number, number, never>, 
    context: CanvasRenderingContext2D,
    position: number
  ) {
    context.save();

    const scaleX = this._zoomTransform.rescaleX(xScale);
    const scaleY = this._zoomTransform.rescaleY(yScale);

    const plotRect = this._currentPlotRect();
    context.clearRect(0, 0, plotRect.innerWidth, plotRect.innerHeight);

    if (position >= 0) {
      context.beginPath();
      context.lineWidth = 1;
      context.strokeStyle = this.playbackPosColor;
      
      const x = scaleX(position);
      const y1 = scaleY(-1);
      const y2 = scaleY(1);
      context.moveTo(x, y1);
      context.lineTo(x, y2);
      context.stroke();
    }

    context.restore();
  }

  private _createWaveformContainer(data: Array<WaveformPoint>) {
    const rect = this._currentPlotRect();
    const container = d3.select(this._waveformContainer!);
   
    // Init Scales
    let xScale = d3.scaleLinear()
      .domain([0, data[data.length - 1].time])
      .range([0, rect.innerWidth]);
    let yScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, rect.innerHeight]);
  
    // Create SVG node
    this._waveformSvg = container
      .append('svg:svg')
      .attr('width', rect.outerWidth)
      .attr('height', rect.outerHeight)
      .style('position', 'absolute')
      .attr('class', 'svg-plot')
      .append('g')
      .attr('transform', `translate(${rect.left}, ${rect.top})`);
    
    // Create X-Axis
    this._waveformSvg.append("g")
      .attr("transform", `translate(0,${rect.innerHeight - rect.bottom})`)
      .call(d3.axisBottom(xScale).ticks(rect.innerWidth / 100, ".2f"))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
          .attr("y2", -rect.innerHeight)
          .attr("stroke-opacity", 0.1)
      );

    // Create Canvas overlay
    this._waveformCanvas = container
      .append('canvas')
      .attr('width', rect.innerWidth)
      .attr('height', rect.innerHeight)
      .style('margin-left', rect.left + 'px')
      .style('margin-top', rect.top + 'px')
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
    this._drawWaveform(xScale, yScale, context, data);
  }

  private _createPlaybackContainer(data: Array<WaveformPoint>) {
    const rect = this._currentPlotRect();
    const container = d3.select(this._playbackContainer!);
   
    // Init Scales
    let xScale = d3.scaleLinear()
      .domain([0, data[data.length - 1].time])
      .range([0, rect.innerWidth]);
    let yScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, rect.innerHeight]);
  
    // Create SVG node
    this._playbackSvg = container
      .append('svg:svg')
      .attr('width', rect.outerWidth)
      .attr('height', rect.outerHeight)
      .style('position', 'absolute')
      .attr('class', 'svg-plot')
      .append('g')
      .attr('transform', `translate(${rect.left}, ${rect.top})`);
   
    // add file name label
    let displayName = appState.selectedFilePath;
    if (displayName.startsWith("./") || displayName.startsWith("\\.")) {
      displayName = displayName.substring(2);
    }
    this._playbackSvg
      .append("g")
      .call(g => g.append("text")
          .attr("x", rect.innerWidth - 8)
          .attr("y", 20)
          .attr("fill", "currentColor")
          .attr("text-anchor", "end")
          .attr("font-size", 12)
          .text(displayName)
      ); 

    // Create Canvas overlay
    this._playbackCanvas = container
      .append('canvas')
      .attr('width', rect.innerWidth)
      .attr('height', rect.innerHeight)
      .style('margin-left', rect.left + 'px')
      .style('margin-top', rect.top + 'px')
      .style('position', 'absolute')
      .attr('class', 'canvas-plot');

    // Create drawing context
    const context = this._playbackCanvas.node()!.getContext('2d')!;

    // listen to file playback position changes
    let renderedFilePath = appState.selectedFileAbsPath;
    this._removePlaybackPositionListener = addPlaybackPositionEventListener((event) => {
        if (path.normalize(renderedFilePath) == path.normalize(event.file_path)) {
          this._drawPlaybackPosition(xScale, yScale, context, event.position);
        }
      }
    );
    this._removePlaybackFinishedListener = addPlaybackFinishedEventListener((event) => {
        if (path.normalize(renderedFilePath) == path.normalize(event.file_path)) {
          this._drawPlaybackPosition(xScale, yScale, context, -1);
        }
      }
    );
  }
  
  disconnectedCallback(): void {
    super.disconnectedCallback();

    // disconnect all listeners 
    if (this._removePlaybackPositionListener) {
      this._removePlaybackPositionListener();
      this._removePlaybackPositionListener = undefined;
    }
    if (this._removePlaybackFinishedListener) {
      this._removePlaybackFinishedListener();
      this._removePlaybackFinishedListener = undefined;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }
  }

  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    // remove all listeners 
    if (this._removePlaybackPositionListener) {
      this._removePlaybackPositionListener();
      this._removePlaybackPositionListener = undefined;
    }
    if (this._removePlaybackFinishedListener) {
      this._removePlaybackFinishedListener();
      this._removePlaybackFinishedListener = undefined;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }
    
    // clear all previous content
    function removeAllChildNodes(parent: HTMLElement) {
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }
    }
    if (this._waveformSvg && this._waveformCanvas) {
      removeAllChildNodes(this._waveformContainer!);
      this._waveformSvg = undefined;
      this._waveformCanvas = undefined;
    }
    if (this._playbackSvg && this._playbackCanvas) {
      removeAllChildNodes(this._playbackContainer!);
      this._playbackSvg = undefined;
      this._playbackCanvas = undefined;
    } 

    // reset state
    this._zoomTransform = d3.zoomIdentity;
    
    // create and render waveform container
    this._createWaveformContainer(this.data);
    // create and render playback pos
    this._createPlaybackContainer(this.data);

    // rebuild everything on size changes
    let isInitialUpdate = true;
    this._resizeObserver = new ResizeObserver(() => {
      if (! isInitialUpdate) {
        this.requestUpdate();
      }
      isInitialUpdate = false;
    });
    this._resizeObserver.observe(this);
  }

  static styles = css`
    :host {
      position: relative;
      overflow: hidden;
    }
    #waveform-container {
      position: absolute;        
			width: 100%; 
      height: 100%;
		}
    #playback-container {
      position: absolute;
      left: 0;
      right: 0;
			height: 100%;
		  width: 100%; 
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
