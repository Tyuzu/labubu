package handlers

import (
	"regexp"
	"strings"
)

type FilterPreset struct {
	ID          string
	Command     string
	TwoInputs   bool
	TwoPass     bool
	NeedsReview bool
}

// AllFilterPresets is the single source of truth for FFmpeg filter commands.
var AllFilterPresets = []FilterPreset{
	{ID: "69", Command: `ffmpeg -i %1 -filter:v "scale=1120:630:force_original_aspect_ratio=decrease,pad=1120:630:(ow-iw)/2:(oh-ih)/2" -c:a copy %1_69.mp4`},
	{ID: "6-filters_noir_etc", Command: `ffmpeg -y -i "%INPUT%" -vf "eq=contrast=1.2:saturation=1.3:brightness=-0.02,colorbalance=rs=0.08:bs=-0.08:gs=-0.02" -c:a copy "output\cinematic.mp4"`},
	{ID: "6-filters_noir_etc", Command: `ffmpeg -y -i "%INPUT%" -vf "rgbashift=rh=8:bh=-8:rv=3:bv=-3,noise=alls=12:allf=t" -c:a copy "output\glitch.mp4"`},
	{ID: "6-filters_noir_etc", Command: `ffmpeg -y -i "%INPUT%" -vf "curves=vintage,noise=alls=18:allf=t,eq=saturation=0.75" -c:a copy "output\vintage.mp4"`},
	{ID: "6-filters_noir_etc", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,eq=contrast=1.7:brightness=-0.04,noise=alls=8:allf=t" -c:a copy "output\noir.mp4"`},
	{ID: "6-filters_noir_etc", Command: `ffmpeg -y -i "%INPUT%" -vf "split[a][b];[a]gblur=sigma=12[blur];[b][blur]blend=all_mode=screen:all_opacity=0.25,eq=saturation=1.2:brightness=0.03" -c:a copy "output\dreamy.mp4"`},
	{ID: "6-filters_noir_etc", Command: `ffmpeg -y -i "%INPUT%" -vf "eq=saturation=2.0:contrast=1.25,colorbalance=rs=-0.08:bs=0.18:gs=-0.02,curves=preset=strong_contrast" -c:a copy "output\cyberpunk.mp4"`},
	{ID: "6-filters_noir_etc", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,edgedetect=low=0.1:high=0.3,negate" -c:a copy "output\sketch.mp4"`},
	{ID: "6-filters_noir_etc", Command: `ffmpeg -y -i "%INPUT%" -vf "noise=alls=20:allf=t,eq=saturation=1.4:contrast=1.15,chromashift=cbh=4:crh=-4" -c:a copy "output\vhs.mp4"`},
	{ID: "8_png_effects", Command: `ffmpeg -y -i "%INPUT%" -vf "%FILTER%" -frames:v 1 "%OUTPUT%_effect%CHOICE%.png"`},
	{ID: "8_video_effects", Command: `ffmpeg -y -i "%INPUT%" -vf "%FILTER%" "%OUTPUT%_effect%CHOICE%.png"`},
	{ID: "8_video_effects", Command: `ffmpeg -y -i "%INPUT%" -vf "%FILTER%" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy "%OUTPUT%_effect%CHOICE%.mp4"`},
	{ID: "96", Command: `ffmpeg -i %1 -filter:v "scale=450:800:force_original_aspect_ratio=decrease,pad=450:800:(ow-iw)/2:(oh-ih)/2" -c:a copy %1_96.mp4`},
	{ID: "amplify", Command: `ffmpeg -i %1 -filter:a "volume=2" %1_amp.mp3`},
	{ID: "anticlk", Command: `ffmpeg -i %1 -vf "transpose=1,transpose=1,transpose=1" %1.mp4`},
	{ID: "ascii-overlay_text", Command: `ffmpeg -i %1 -vf "format=gray, scale=iw/2:-1, drawtext=fontfile=BreezeSans:text='TEXT':x=(w-tw)/2:y=(h-th)/2, scale=iw*2:ih*2:flags=neighbor" %1_ascii.mp4`},
	{ID: "bleach", Command: `ffmpeg -i %1 -vf "colorchannelmixer=rr=1.25:gg=1.25:bb=1.25:aa=1.0,eq=saturation=0.3:contrast=1.2,format=yuv420p" %1_bleach.mp4`},
	{ID: "blend_ltr", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='A*(X/W)+B*(1-X/W)',format=yuv420p" %1_ltr.mp4`, TwoInputs: true},
	{ID: "blended", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='B*(Y/H)+A*(1-Y/H)',format=yuv420p" -crf 21 -r 59 -pix_fmt yuv420p %1_zzb.mp4`, TwoInputs: true},
	{ID: "blue_tint", Command: `ffmpeg -i %1 -vf colorchannelmixer=.5:.2:.1:0:.7:.3:0:.1:.9:.5 -c:a copy %1_allblu.mp4`},
	{ID: "bluish_tint", Command: `ffmpeg -i %1 -vf colorchannelmixer=.3:.3:.3:.2:.2:.2:.1:.1:.8 -c:a copy %1_bnwblu.mp4`},
	{ID: "blur_top_part", Command: `ffmpeg -i %1 -filter_complex "[0:v]crop=in_w:in_h/3:0:0,boxblur=10[bg]; [0:v][bg]overlay=0:0[v]" -map "[v]" %1_blurnot.mp4`},
	{ID: "boxblur", Command: `ffmpeg -i %1 -filter_complex "[0:v]split=2[bg][fg]; [fg]crop=360:360:0:0,boxblur=10:1[blurred]; [bg][blurred]overlay=0:0" %1_qb.mp4.mp4`},
	{ID: "brightened_contra_sat", Command: `ffmpeg -i %1 -vf "curves=all='0/0 0.1/0.8 0.9/0.8'" %1_FADE_EFFECT.mp4`},
	{ID: "brptix", Command: `ffmpeg -i %1 -vf "curves=all='0/0 0.2/0.4 0.8/0.8 1/1'" %1_brighten_dark_pixels.mp4`},
	{ID: "brtblr", Command: `ffmpeg -i %1 -filter_complex "[0:v]format=pix_fmts=rgb24,boxblur=luma_radius=3:luma_power=2:chroma_radius=3:chroma_power=2,eq=brightness=0.1:saturation=2.0,palettegen=max_colors=256[palette]; [0:v]format=pix_fmts=rgb24,boxblur=luma_radius=3:luma_power=2:chroma_radius=3:chroma_power=2,eq=brightness=0.1:saturation=2.0[x]; [x][palette]paletteuse=new=1:dither=1" %1_brtblr.mp4`},
	{ID: "chessboard_2_vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(X/64)+floor(Y/64)\,2)\,0)\,A,B)'" output_chessboard.mp4`, TwoInputs: true},
	{ID: "cinematic", Command: `ffmpeg -i %1 -vf "eq=contrast=1.3:saturation=1.2,curves=all='0/0 0.3/0.4 0.7/0.6 1/1'" %1_cinematic.mp4`},
	{ID: "circular_reveal_2vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(gt(sqrt(pow(X-W/2\,2)+pow(Y-H/2\,2))-T*100\,0)\,A,B)'" output_circular_wipe.mp4`, TwoInputs: true},
	{ID: "clockwise", Command: `ffmpeg -i %1 -vf "transpose=1" %1.jpg`},
	{ID: "clockwise_rotate", Command: `ffmpeg -i %1 -vf "transpose=1" %1.mp4`},
	{ID: "color_correction", Command: `ffmpeg -i %1 -vf "eq=brightness=0.1:saturation=1.5:contrast=1.2" %1_clrcrc.mp4`},
	{ID: "colorless", Command: `ffmpeg -i %1 -vf colorchannelmixer=.5:.5:.5:.5:.5:.5:.5:.5:.5 -c:a copy -pix_fmt yuv420p %1_ftg.mp4`},
	{ID: "colorlevels_brt", Command: `ffmpeg -i %1 -filter:v colorlevels=rimax=0.900:gimax=0.800:bimax=0.800,format=yuv420p %1_clrlvl.mp4`},
	{ID: "comic", Command: `ffmpeg -i %1 -vf "edgedetect=mode=colormix,eq=contrast=1.5:brightness=0.05:saturation=2.0,curves=vintage" -c:a copy %1_comic.mp4`},
	{ID: "comic_layout", Command: `ffmpeg -y -i "%INPUT%"`, NeedsReview: true},
	{ID: "concentric_2_video", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(sqrt(pow(X-W/2\,2)+pow(Y-H/2\,2))/32)\,2)\,0)\,A,B)'" output_circular_pattern.mp4`, TwoInputs: true},
	{ID: "contours", Command: `ffmpeg -i %1 -vf "split[main][edge];[edge]edgedetect=low=0.02:high=0.08, colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3 [edges]; [main][edges]overlay" %1_3.mp4`},
	{ID: "contrast", Command: `ffmpeg -i %1 -vf eq=contrast=1.9 %1_contra.mp4`},
	{ID: "crossprocess", Command: `ffmpeg -i %1 -vf "curves=red='0/0 0.5/0.7 1/1':green='0/0 0.5/0.6 1/1':blue='0/0 0.5/0.5 1/1'" %1_cross_process.mp4`},
	{ID: "crsproc_negate", Command: `ffmpeg -i %1 -filter:v curves=preset=color_negative %1_cross.mp4`},
	{ID: "Cut", Command: `ffmpeg -y -ss 00:04:07.000 -i %1 -to 00:00:30.000 -c copy -copyts %_cuts.mp3`},
	{ID: "cutter", Command: `ffmpeg -i %1 -c copy -map 0 -segment_time 91 -f segment output%%03d.mp4`},
	{ID: "cynotape", Command: `ffmpeg -i %1 -vf colorchannelmixer=.5:.5:.5:0:.5:0:0:0:.5:.5 -c:a copy %1_cynotape.mp4`},
	{ID: "dark_edges", Command: `ffmpeg -i %1 -vf "convolution='-1 -1 -1 -1 8 -1 -1 -1 -1'" %1_drked.mp4`},
	{ID: "dark_edges_darken", Command: `ffmpeg -i %1 -filter_complex "[0:v]sobel=planes=0xf:scale=1,negate [sob];[0:v][sob]blend=all_mode=multiply" -preset veryslow -tune film -crf 15 -c:a copy -pix_fmt yuv420p -movflags +faststart %1_f.mp4`},
	{ID: "darksepia", Command: `ffmpeg -i %1 -vf colorchannelmixer=0.5:0.5:0.3:0.5:0.5:0.3:0.5:0.5:0.3 -c:a copy %1_drksepia.mp4`},
	{ID: "deep_blue_tint", Command: `ffmpeg -i %1 -filter_complex "colorchannelmixer=rr=0:gg=0:bb=1.5" %1_bluehole.mp4`},
	{ID: "diagonal_stripes_2vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor((X+Y)/64)\,2)\,0)\,A,B)'" output_diagonal_stripes.mp4`, TwoInputs: true},
	{ID: "diagonal_wipe_2vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor((X+Y+T*100)/64)\,2)\,0)\,A,B)'" output_animated_diagonal_stripes.mp4`, TwoInputs: true},
	{ID: "diagonalStripes", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor((X-Y)/64)\,2)\,0)\,A,B)'" output_diagonal_boxes.mp4`, TwoInputs: true},
	{ID: "diamond_chk_2vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(abs(X-Y)/32)+floor(abs(X+Y-W-H)/32)\,2)\,0)\,A,B)'" output_diamond_pattern.mp4`, TwoInputs: true},
	{ID: "diamondwipe_2vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(gt(abs(X-W/2)+abs(Y-H/2)-T*100\,0)\,A,B)'" output_diamond_wipe.mp4`, TwoInputs: true},
	{ID: "digonal_stripes_static_2vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(gt(sin(0.05*X+0.1*Y)\,0.5),A,B)'" output_sinusoidal_waves.mp4`, TwoInputs: true},
	{ID: "dilation", Command: `ffmpeg -i %1 -vf dilation %1_dilation.mp4`},
	{ID: "drawtext top bottom", Command: `ffmpeg -i %1 -filter_complex "[0:v]transpose=1[anticlockwiserotated];[anticlockwiserotated]drawtext=fontfile=Breezesans:text='Chuu':x=(w-tw)/2: y=h-2*th: fontsize=24: fontcolor=white,drawtext=fontfile=Breezesans:text='Heejin Bad Hands':x=(w-tw)/2: y=th: fontsize=24: fontcolor=white:[textapplied];[textapplied]transpose=2" %1_f.mp4`},
	{ID: "drawtxt_shadow", Command: `ffmpeg -i %1 -filter_complex "[0:v]drawtext=text='Example Text':fontfile=/path/to/font.ttf:fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:borderw=2:bordercolor=black,drawtext=text='Example Text':fontfile=/path/to/font.ttf:fontcolor=black:fontsize=48:x=(w-text_w)/2+2:y=(h-text_h)/2+2[txt];[0:v][txt]overlay" %1_teshd.mp4`},
	{ID: "dreamybright", Command: `ffmpeg -i %1 -vf colorchannelmixer=1.2:0.5:0.5:0.5:1.2:0.5:0.5:0.5:1.2 -c:a copy %1_dreamy.mp4`},
	{ID: "dull_contrast", Command: `ffmpeg -i %1 -vf "eq=saturation=0.2:brightness=-0.05:contrast=0.9,format=yuv420p" %1_foggy.mp4`},
	{ID: "duotone", Command: `ffmpeg -i %1 -filter_complex "[0:v]format=gray[v0];gradients=s=256x1:c0=0x00ffff:c1=0xffff00:c2=0xff00ff:x0=0:y0=0:x1=256:y1=0:n=3,trim=end_frame=1[v1];[v0][v1]paletteuse" %1_duorndm.mp4`},
	{ID: "dynamic_vertical_bars_vflipping", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(X/64)+floor(T*5)\,2)\,0)\,A,B)'" output_dynamic_vertical_bars.mp4`, TwoInputs: true},
	{ID: "expanSquares", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(sqrt(pow(X-W/2\,2)+pow(Y-H/2\,2))/T*10)\,2)\,0)\,A,B)'" output_expanding_squares.mp4`, TwoInputs: true},
	{ID: "extra_bright", Command: `ffmpeg -i %1 -crf 0 -vf lutyuv=u='val':v='val':y='3*val' %1_lut.mp4`},
	{ID: "fadedposter", Command: `ffmpeg -i %1 -vf colorchannelmixer=.5:.5:.5:.5:.5:.5:.5:.5:.5 -c:a copy %1_poster.mp4`},
	{ID: "fadin effect", Command: `ffmpeg -i %1 -vf "fade=in:st=0:d=3,fade=out:st=27:d=3" %1_o.mp4`},
	{ID: "faint_bluetint_only", Command: `ffmpeg -i %1 -vf colorchannelmixer=0.5:0.5:0.5:0.3:0.8:0.3:0.2:0.2:1.2 -c:a copy %1_bluetint.mp4`},
	{ID: "gamma_fold", Command: `ffmpeg -i %1 -vf "eq=gamma=1.3:contrast=1.1:saturation=1.0,format=yuv420p" %1_gammafolds.mp4`},
	{ID: "gausblr", Command: `ffmpeg -i %1 -filter_complex "[0:v]boxblur=5:1[v]" -map "[v]" -c:v libx264 -crf 23 %1_gausblr.mp4`},
	{ID: "gif_like_ckrbrd", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(X\,4)+mod(Y\,4)\,4)\,A,B)'" output.mp4`, TwoInputs: true},
	{ID: "glow_BnW", Command: `ffmpeg -i %1 -filter_complex "[0:v]eq=contrast=1.2:saturation=0,format=yuv420p" %1_glowbnw.mp4`},
	{ID: "glowing_edges", Command: `ffmpeg -i %1 -filter:v convolution="0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:5:5:5:1:0:128:128:128" %1_dedged.mp4`},
	{ID: "gold", Command: `ffmpeg -i %1 -vf colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131 -c:a copy %1_gold.mp4`},
	{ID: "gold_sobel_edges", Command: `ffmpeg -i %1 -vf "split=2[in][tmp];[in]sobel[edged];[tmp]palettegen[palette];[edged][palette]paletteuse" %1_goldsol.mp4`},
	{ID: "grain", Command: `ffmpeg -i %1 -vf "noise=alls=50:allf=t+u" -c:v libx264 -crf 18 -preset slow -c:a copy %1.mp4`},
	{ID: "grainy_bright", Command: `ffmpeg -i %1 -filter_complex "[0:v]eq=brightness=0.1:saturation=1.5:contrast=1.2:gamma=1.2,noise=alls=30:allf=t+u[v];[v]split[a][b];[a]palettegen[p];[b][p]paletteuse" %1_grainy.mp4`},
	{ID: "green_edges", Command: `ffmpeg -i %1 -vf "split=2[in][tmp];[in]sobel[edged];[tmp][edged]overlay=format=auto" %1_edggrn.mp4`},
	{ID: "green_tint", Command: `ffmpeg -i %1 -filter_complex "colorchannelmixer=rr=1.2:gg=1.9:bb=0" %1_brew.mp4`},
	{ID: "greenPixels", Command: `ffmpeg -i %1 -filter_complex "[0:v]split[original][copy];[copy]geq=r='if(lt(random(1),0.3),255,max(0,min(255,random(1)*255)))':g='if(lt(random(1),0.3),255,max(0,min(255,random(1)*255)))':b='if(lt(random(1),0.3),255,max(0,min(255,random(1)*255)))'[sorted];[original][sorted]blend=all_mode=difference" %1_pixort.mp4`},
	{ID: "greenscreenEffect", Command: `ffmpeg -i %1 -i %2 -filter_complex "[1:v]colorkey=000000:0.3:0.02[tmp];[0:v][tmp]overlay" output01.mp4`, TwoInputs: true},
	{ID: "greentint", Command: `ffmpeg -i %1 -vf colorchannelmixer=-1:-1:-1:0:1:0:0:1:0:0:1 -c:a copy %1_ccmgrn.mp4`},
	{ID: "gta", Command: `ffmpeg -y -i "%INPUT%"`, NeedsReview: true},
	{ID: "half_td_merge", Command: `ffmpeg -i %1 -i %2 -filter_complex "[0:v]crop=iw:ih/2:0:oh[top]; [1:v]crop=iw:ih/2:0:0[bottom]; [bottom][top]vstack" %1_tbt.mp4`, TwoInputs: true},
	{ID: "halftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.5:brightness=0,geq=lum='if(lte(hypot(mod(X\,6)-3\,mod(Y\,6)-3)\,2.7*(1-lum(X-mod(X\,6)+3\,Y-mod(Y\,6)+3)/255))\,0\,255)',lutrgb=r='92+val*0.482':g='89+val*0.447':b='69+val*0.369'" -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a copy %1_.mp4`},
	{ID: "halftone-dot", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.5:brightness=0,geq=lum='if(lte(hypot(mod(X\,6)-3\,mod(Y\,6)-3)\,2.7*(1-lum(X-mod(X\,6)+3\,Y-mod(Y\,6)+3)/255))\,0\,255)',lutrgb=r='92+val*0.482':g='89+val*0.447':b='69+val*0.369'" %1_halftone.mp4`},
	{ID: "hexpattern", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(abs(X-Y)/64)+floor(abs(X+Y-W-H)/64)\,2)\,0)\,A,B)'" output_expanding_hexagons.mp4`, TwoInputs: true},
	{ID: "hflip", Command: `ffmpeg -i %1 -vf "hflip" %1_hflip.mp4`},
	{ID: "hflipping_2vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(Y/64)+floor(T*5)\,2)\,0)\,A,B)'" output_dynamic_horizontal_bars.mp4`, TwoInputs: true},
	{ID: "hicontrast_bw", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=3:brightness=0" %1_high_contrast_bw.mp4`},
	{ID: "horizontal_stripes", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(Y/64)\,2)\,0)\,A,B)'" output_horizontal_stripes.mp4`, TwoInputs: true},
	{ID: "hscanline_office_shades", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(Y/4\,2)\,0)\,A,B)'" output_horizontal_scanlines.mp4`, TwoInputs: true},
	{ID: "huey", Command: `ffmpeg -i %1 -vf "eq=brightness=0.1:contrast=2" %1_huey.mp4`},
	{ID: "images_to_video", Command: `ffmpeg -i %%03d.tiff -c:v libx264 -preset veryslow -crf 16 i2v.mp4`},
	{ID: "invert_normal", Command: `ffmpeg -i %1 -vf "edgedetect=enable='gt(mod(t,60),57)',negate" -c:a copy %1_ed.mp4`},
	{ID: "laplace", Command: `ffmpeg -i %1 -filter:v convolution="1 1 1 1 -8 1 1 1 1:1 1 1 1 -8 1 1 1 1:1 1 1 1 -8 1 1 1 1:1 1 1 1 -8 1 1 1 1:5:5:5:1:0:128:128:0" %1_lap.mp4`},
	{ID: "lens_distortion", Command: `ffmpeg -i %1 -vf "lenscorrection=k1=0.5:k2=0.2" %1_lens_distortion.mp4`},
	{ID: "lightleak", Command: `ffmpeg -i %1 -vf "curves=red='0/0 0.3/0.5 0.7/0.7 1/1':green='0/0 0.2/0.4 0.8/0.6 1/1':blue='0/0 0.1/0.3 0.9/0.5 1/1',hue=s=0" %1_infrared_thermal.mp4`},
	{ID: "lil_orng", Command: `ffmpeg -i %1 -filter_complex colorchannelmixer=".964:.456:.865:0:.423:.486:.495:0:.472:.334:.431",format=yuv420p %1_lil_orng.mp4`},
	{ID: "low saturation", Command: `ffmpeg -i %1 -vf colorchannelmixer=.8:.2:.4:.1:.5:.7:.3:.6:.9 -c:a copy %1_blkink.mp4`},
	{ID: "lowQ", Command: `ffmpeg -i %1 -vcodec libx264 -crf 25 -pix_fmt yuv420p %1_lq.mp4`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,edgedetect=low=0.08:high=0.25,negate,eq=contrast=2.2:brightness=-0.05" -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k "%OUT%\01_woodcut_print.mp4"`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,split[a][b];[a]gblur=sigma=5[blur];[b][blur]blend=all_mode=divide,eq=contrast=2.0:brightness=-0.08,noise=alls=12:allf=t" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\02_charcoal_drawing.mp4"`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,edgedetect=low=0.08:high=0.2,negate,eq=contrast=2.5" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\03_crosshatch.mp4"`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,format=gray,noise=alls=8:allf=t,eq=contrast=2.0,format=gray,geq=lum='if(gt(lum(X,Y),128),255,0)'" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\04_newspaper_print.mp4"`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,eq=contrast=1.5:brightness=0.08,colorize=hue=120:saturation=0.9,noise=alls=12:allf=t,vignette=PI/5" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\05_night_vision.mp4"`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,edgedetect=low=0.05:high=0.2,negate,colorize=hue=205:saturation=1.0,eq=brightness=0.05:contrast=1.8" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\06_laser_scan.mp4"`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "negate,format=gray,colorize=hue=195:saturation=0.85,eq=contrast=1.5:brightness=0.04" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\07_xray_vision.mp4"`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "edgedetect=low=0.03:high=0.12,negate,format=gray,eq=contrast=2.5,format=rgb24,colorbalance=bs=0.15:rs=0.05" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\08_cracked_glass.mp4"`},
	{ID: "many 34", Command: `ffmpeg -y -i "%INPUT%" -vf "split[a][b];[a]gblur=sigma=8[blur];[b][blur]blend=all_mode=screen:all_opacity=0.18,eq=saturation=1.25:brightness=0.03" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\09_heat_mirage.mp4"`},
	{ID: "many", Command: `ffmpeg -i %1 -vf "edgedetect=low=0.1:high=0.4,negate,hue=s=0" output_cartoon.mp4`},
	{ID: "many", Command: `ffmpeg -i %1 -filter_complex "[0:v]split[a][b];[a]null[c];[b]format=gray[d];[c][d]hstack" output_split_screen.mp4`},
	{ID: "many", Command: `ffmpeg -i %1 -filter_complex "[0:v]scale=iw/3:ih/3[pip];[0:v][pip]overlay=W-w-10:H-h-10" output_pip.mp4`},
	{ID: "many", Command: `ffmpeg -i %1 -vf "vignette" output_vignette.mp4`},
	{ID: "many", Command: `ffmpeg -i %1 -vf "chromakey=black:0.1:0.1,loop=loop=2:size=2,format=yuv420p,negate" output_glitch.mp4`},
	{ID: "many", Command: `ffmpeg -i %1 -filter_complex "[0:v]split[a][b];[b]hflip,format=yuv420p[bottom];[a][bottom]hstack" output_split_top_bottom.mp4`},
	{ID: "many", Command: `ffmpeg -i %1 -vf "colorbalance=rs=.3:gs=.3:bs=.3" output_color_balance.mp4`},
	{ID: "many", Command: `ffmpeg -i %1 -vf "colorchannelmixer=0.5:0.5:0:0:0.5:0.5:0:0:0.5:0.5" output_duotone.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3,eq=brightness=0.3:saturation=1.5" output_thermal.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "curves=green=0/0.0:0.1/0.5:1.0/1.0,eq=contrast=1.5:brightness=0.1" output_night_vision.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "edgedetect=low=0.1:high=0.4,format=gray" output_sketch.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "edgedetect=low=0.1:high=0.4,curves=preset=medium_contrast,format=gray,noise=alls=20:allf=t" output_watercolor.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "lenscorrection=cx=0.5:cy=0.5:k1=-0.5:k2=0.5" output_fisheye.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "noise=alls=20:allf=t,format=yuv420p,geq='p(X,Y)*(random(1)*0.05+1)'" output_old_tv.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "geq='lum(X,Y)*random(1)*255:128:128',hue=s=0" output_particles.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "tblend=all_mode=addition,framestep=2" output_colorful_trails.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "split[main][mirror];[mirror]hflip[ref];[main][ref]hstack,split[a][b];[b]vflip[ref2];[a][ref2]vstack" output_mirror_kaleidoscope.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "stereo3d=sbsl:arcc" output_anaglyph.mp4`},
	{ID: "many2", Command: `ffmpeg -i %1 -vf "boxblur=luma_radius=10:luma_power=2" output_radial_blur.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.4,geq=lum='if(lte(hypot(mod(X\,4)-2\,mod(Y\,4)-2)\,1.9*(1-lum(X-mod(X\,4)+2\,Y-mod(Y\,4)+2)/255))\,0\,255)',lutrgb=r='95+val*0.47':g='88+val*0.43':b='67+val*0.35',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_fine.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.8,geq=lum='if(lte(hypot(mod(X\,9)-4.5\,mod(Y\,9)-4.5)\,4*(1-lum(X-mod(X\,9)+4.5\,Y-mod(Y\,9)+4.5)/255))\,0\,255)',lutrgb=r='80+val*0.52':g='75+val*0.48':b='54+val*0.39',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_newspaper.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.9,geq=lum='if(lte(hypot(mod(X\,6)-3\,mod(Y\,6)-3)\,3.1*(1-lum(X-mod(X\,6)+3\,Y-mod(Y\,6)+3)/255))\,0\,255)',lutrgb=r='64+val*0.58':g='63+val*0.53':b='45+val*0.43',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_olive.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=2.2,geq=lum='if(lte(hypot(mod(X\,6)-3\,mod(Y\,6)-3)\,3.2*(1-lum(X-mod(X\,6)+3\,Y-mod(Y\,6)+3)/255))\,0\,255)',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_comic.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.6,geq=lum='if(lte(hypot(mod(X\,6)-3\,mod(Y\,6)-3)\,2.8*(1-lum(X-mod(X\,6)+3\,Y-mod(Y\,6)+3)/255))\,0\,255)',lutrgb=r='110+val*0.46':g='67+val*0.49':b='46+val*0.43',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_rust.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.7,geq=lum='if(lte(hypot(mod(X\,6)-3\,mod(Y\,6)-3)\,2.8*(1-lum(X-mod(X\,6)+3\,Y-mod(Y\,6)+3)/255))\,0\,255)',lutrgb=r='48+val*0.43':g='65+val*0.47':b='83+val*0.48',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_blue.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.8,geq=lum='if(lte(hypot(mod(X\,14)-7\,mod(Y\,14)-7)\,6*(1-lum(X-mod(X\,14)+7\,Y-mod(Y\,14)+7)/255))\,0\,255)',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_popart.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.6,geq=lum='if(lte(hypot(mod((X+Y)*0.707\,6)-3\,mod((Y-X)*0.707\,6)-3)\,2.8*(1-lum(X\,Y)/255))\,0\,255)',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_diagonal.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,eq=contrast=1.8,noise=alls=8:allf=t+u,geq=lum='if(lte(hypot(mod(X\,6)-3\,mod(Y\,6)-3)\,2.8*(1-lum(X-mod(X\,6)+3\,Y-mod(Y\,6)+3)/255))\,0\,255)',lutrgb=r='92+val*0.48':g='80+val*0.45':b='59+val*0.37',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_distressed.mp4`},
	{ID: "manyhalftone", Command: `ffmpeg -i %1 -vf "format=gray,negate,eq=contrast=1.6,geq=lum='if(lte(hypot(mod(X\,6)-3\,mod(Y\,6)-3)\,2.8*(1-lum(X-mod(X\,6)+3\,Y-mod(Y\,6)+3)/255))\,0\,255)',format=yuv420p" -c:v libx264 -crf 18 -preset medium -c:a copy %1_inverted.mp4`},
	{ID: "mini_pip_effect", Command: `ffmpeg -i %1 -filter_complex "[0:v]split=2[main][overlay];[overlay]scale=iw/2:ih/2[small];[main][small]overlay=W-w-10:H-h-10" %1_mini.mp4`},
	{ID: "minter", Command: `ffmpeg -i %1 -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc" %1_mci.mp4`},
	{ID: "mirrorEffect", Command: `ffmpeg -y -i %1 -vf "crop=iw:ih:0:0,split[left][tmp];[tmp]hflip[right];[right][left] hstack" -pix_fmt yuv420p %1_gfr.mp4`},
	{ID: "mosaic", Command: `ffmpeg -i %1 -filter_complex "[0:v]scale=iw/10:-1,scale=iw*10:-1:flags=neighbor" %1_mosaic.mp4`},
	{ID: "mov_to_mp4", Command: `ffmpeg -i %1 -qscale 0 output.mp4`},
	{ID: "negclr", Command: `ffmpeg -i %1 -vf "lutyuv='y=negval',colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131" -c:a copy %1_neg_clr.mp4`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "eq=saturation=0.55:contrast=1.55:brightness=-0.02,colorbalance=rs=0.04:bs=-0.03" -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k "%OUT%\01_bleach_bypass.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -filter_complex "[0:v]split[a][b];[a]hflip,eq=brightness=0.08:saturation=0.7[base];[b]format=yuva420p,colorchannelmixer=aa=0.35[overlay];[base][overlay]overlay=shortest=1,eq=contrast=1.2[out]" -map "[out]" -map 0:a? -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\02_double_exposure.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,split[a][b];[a]gblur=sigma=3[blur];[b][blur]blend=all_mode=divide,eq=contrast=1.5" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\03_pencil_sketch.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,colorize=hue=220:saturation=0.8" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\04_duotone.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,eq=contrast=3:brightness=-0.35,threshold=128" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\05_silhouette.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "scale=iw/24:ih/24:flags=neighbor,scale=iw*24:ih*24:flags=neighbor" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\06_pixelation.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "split[a][b];[b]hflip[flip];[a][flip]hstack=inputs=2" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\07_mirror_reflection.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "scale=160:90:flags=neighbor,format=gray,edgedetect=low=0.1:high=0.3,negate" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\08_ascii_style.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "scale=iw/32:ih/32:flags=neighbor,format=rgb24,scale=iw*32:ih*32:flags=neighbor,eq=saturation=1.5:contrast=1.2" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\09_8bit_retro.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "split[a][b];[a]crop=iw:ih/3:0:0, pad=iw:ih:0:0[one];[b]crop=iw:ih/3:0:ih/3,hflip,tpad=start_duration=0[ two];[one][two]overlay=0:H/3:shortest=1[out]" -map "[out]" -map 0:a? -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\10_slice_displacement.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,eq=contrast=1.5:brightness=0.02,format=gray,negate,format=gray,geq=lum_expr='255*clip((lum(X,Y)-32)/192,0,1)',format=gray,split[a][b];[a]lut=y='if(lt(val,85),0,if(lt(val,170),255,255))':u=128:v=128[a1];[b]format=gray,format=yuv420p[out]" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\11_heat_map.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "eq=contrast=1.8:brightness=-0.13:saturation=0.8,curves=all='0/0 0.2/0.02 0.5/0.35 1/1'" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\12_shadow_crush.mp4"`},
	{ID: "newart", Command: `ffmpeg -y -i "%INPUT%" -vf "format=rgb24,posterize=levels=4" -c:v libx264 -crf 18 -preset medium -c:a aac "%OUT%\13_extreme_posterize.mp4"`},
	{ID: "no hdr", Command: `ffmpeg -i %1 -vf "unsharp=luma_msize_x=7:luma_msize_y=7:luma_amount=1.5,eq=brightness=0.03:contrast=1.2,format=yuv420p" %1_crispfolds.mp4`},
	{ID: "noau", Command: `ffmpeg -i %1 -c:v copy -an -pix_fmt yuv420p %1.mp4`},
	{ID: "noir_", Command: `ffmpeg -y -i "%INPUT%" -vf "format=gray,gblur=sigma=0.5,eq=contrast=2.0:brightness=0.03:saturation=0,unsharp=7:7:2.0,lut=y='if(lt(val,145),0,255)'" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p "%OUTPUT%.mp4"`},
	{ID: "noirtan", Command: `ffmpeg -i %1 -vf "eq=contrast=2.0:brightness=-0.1:saturation=0.0,format=yuv420p" %1_noir.mp4`},
	{ID: "obsh", Command: `ffmpeg -i %1 -filter_complex "[0:v]crop=iw:ih/2:0:0[left]; [0:v]crop=iw:ih/2:0:oh[right]; [left][right]hstack[v]" -map "[v]" %1_obsh.mp4`},
	{ID: "obsv", Command: `ffmpeg -i %1 -filter_complex "[0:v]crop=iw/2:ih:0:0[left]; [0:v]crop=iw/2:ih:ow:0[right]; [left][right]vstack[v]" -map "[v]" %1_obsv.mp4`},
	{ID: "one_pixel_chessboard", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(X,4),mod(Y,4)),A,B)'" %1_chk.mp4`, TwoInputs: true},
	{ID: "overlay__text", Command: `ffmpeg -i %1 -filter_complex "[0:v]drawbox=c=black@0.5:enable='between(t,1,5)',drawtext=text='Sample Text':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,1,5)'[text];[0:v][text]overlay=0:0" %1_txt.mp4`},
	{ID: "overlay_drawtext", Command: `ffmpeg -i %1 -vf "drawbox=x=iw/3-100:y=ih-160:color=black@0.8:width=iw/2:height=72:t=fill,drawtext=text='Hi! This is STAYC ...':x=w/2-tw/2:y=h-th-100:font=Breezesans:fontsize=72:fontcolor=white" -c:a copy %1.mp4`},
	{ID: "overlayvideo_3vid", Command: `ffmpeg -i %1 -i %2 -filter_complex "[0:v][1:v]overlay=x='if(gte(t,2), (W-w)/2, -100)':y='if(gte(t,2), (H-h)/2, -100)'" output.mp4`, TwoInputs: true},
	{ID: "picsel", Command: `ffmpeg -i %1 -filter_complex "[0:v]scale=iw/10:-1,scale=iw*10:-1:flags=neighbor" %1_picsel.mp4`},
	{ID: "pixel", Command: `ffmpeg -y -i %1 -vf pixelize=w=4:h=4 %1_px.mp4`},
	{ID: "polaroid", Command: `ffmpeg -i %1 -vf "pad=iw+20:ih+20:(ow-iw)/2:(oh-ih)/2:color=white,drawbox=x=10:y=10:w=iw-20:h=ih-20:color=black@0.5:t=2" %1_polaroid.mp4`},
	{ID: "polaroid_border", Command: `ffmpeg -i %1 -vf "pad=iw+80:ih+80:(ow-iw)/2:(oh-ih)/2:color=white" %1_bordered.mp4`},
	{ID: "Quantum", Command: `ffmpeg -i %1 -filter_complex "[0:v]scale=640:360,tmix=frames=10:weights='1 1 1 1 1 1 1 1 1 1'[v]" -map "[v]" -c:v libx264 -crf 23 %1_heatmap.mp4`},
	{ID: "radial_checkerboard", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(sqrt(pow(X-W/2\,2)+pow(Y-H/2\,2))/64)+floor(atan2(Y-H/2\,X-W/2)/3.14*64)\,2)\,0)\,A,B)'" output_radial_checkerboard.mp4`, TwoInputs: true},
	{ID: "rainbow", Command: `ffmpeg -i %1 -vf "hue='h=mod(t*50,360)':s=1" %1_rainbow.mp4`},
	{ID: "redtint", Command: `ffmpeg -i %1 -vf "format=gray,colorchannelmixer=rr=1:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0" %1_bw_red_tint.mp4`},
	{ID: "sand", Command: `ffmpeg -i %1 -vf "colorchannelmixer=rr=0:rg=0.6:rb=1:gr=0:gg=0.4:gb=0.8:br=0:bg=0:bb=0.5" %1_thermal_blue_red.mp4`},
	{ID: "segcut", Command: `ffmpeg -i %1 -c copy -map 0 -segment_time 3 -f segment output%%03d.mp4`},
	{ID: "sepiaton", Command: `ffmpeg -i %1 -vf "colorchannelmixer=rr=0.393:rg=0.769:rb=0.189:gr=0.349:gg=0.686:gb=0.168:br=0.272:bg=0.534:bb=0.131" -c:a copy %1_sepea.mp4`},
	{ID: "smooth-vid", Command: `ffmpeg -i %1 -filter:v "minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=60'" %1.mp4`},
	{ID: "smtpbars", Command: `ffmpeg -f lavfi -i smptebars=size=1280x720:rate=30 -t 10 output.mp4`},
	{ID: "sobel", Command: `ffmpeg -i %1 -vf "split[a][b];[a]sobel[edges];[b][edges]hstack" %1_sob.mp4`},
	{ID: "spilittone", Command: `ffmpeg -i %1 -vf colorchannelmixer=.7:.3:.1:.2:.6:.1:.1:.2:.8 -c:a copy %1_splton.mp4`},
	{ID: "spira", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(atan2(Y-H/2\,X-W/2)/3.14*64)+floor(sqrt(pow(X-W/2\,2)+pow(Y-H/2\,2))/32)\,2)\,0)\,A,B)'" output_spiral_pattern.mp4`, TwoInputs: true},
	{ID: "sq", Command: `ffmpeg -i %1 -filter:v "scale=720:720:force_original_aspect_ratio=decrease,pad=720:720:(ow-iw)/2:(oh-ih)/2" -c:a copy %1_sq.mp4`},
	{ID: "stabilize", Command: `ffmpeg -i %1 -vf vidstabdetect=shakiness=10:accuracy=15 -f null -`, TwoPass: true},
	{ID: "stabilize", Command: `ffmpeg -i %1 -vf vidstabtransform=zoom=0:smoothing=10 -vcodec libx264 -preset slow -tune film -crf 23 -an %1_stab.mp4`, TwoPass: true},
	{ID: "starpsatt", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(sin(X/64)*cos(Y/64)*32)\,2)\,0)\,A,B)'" output_star_pattern.mp4`, TwoInputs: true},
	{ID: "sunrayspatt", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(atan2(Y-H/2\,X-W/2)/3.14*32)+floor(sqrt(pow(X-W/2\,2)+pow(Y-H/2\,2))/(T*20))\,2)\,0)\,A,B)'" output_animated_spiral_checkerboard.mp4`, TwoInputs: true},
	{ID: "swapuv", Command: `ffmpeg -i %1 -vf swapuv %1_swapuv.mp4`},
	{ID: "therm", Command: `ffmpeg -i %1 -vf "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3,eq=brightness=0.3:saturation=1.5" %1_thermal.mp4`},
	{ID: "tiltedFilmstripes", Command: `ffmpeg -y -i "%INPUT%"`, NeedsReview: true},
	{ID: "time_based_checkerboard", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor((X+Y+T*100)/64)\,2)\,0)\,A,B)'" output_time_based_checkerboard.mp4`, TwoInputs: true},
	{ID: "to_mp3", Command: `ffmpeg -i %1 -vf copy %1.mp3`},
	{ID: "to_mp4", Command: `ffmpeg -i %1 -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" %1.mp4`},
	{ID: "to_webm", Command: `ffmpeg -i %1 %1.webm`},
	{ID: "too_edited_effect", Command: `ffmpeg -i %1 -vf "convolution='-1 -1 -1 -1 9 -1 -1 -1 -1'" output.mp4`},
	{ID: "topBlur", Command: `ffmpeg -i %1 -filter_complex "[0:v]crop=in_w:3*in_h/8:0:0,boxblur=10,lutyuv=y=val:u=val:v=val[fg]; [0:v][fg]overlay=0:0[v]" -map "[v]" %1_blurnot.mp4`},
	{ID: "trainwindows", Command: `ffmpeg -y -i "%INPUT%"`, NeedsReview: true},
	{ID: "transpose", Command: `ffmpeg -i %1 -vf "transpose=1" %1_.mp4`},
	{ID: "trgsn", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='A*(if(gte(T,1),1,T/1))+B*(1-(if(gte(T,1),1,T/1)))',format=yuv420p" %1_trn.mp4`, TwoInputs: true},
	{ID: "ttb", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='B*(Y/H)+A*(1-Y/H)',format=yuv420p" %1_ttb.mp4`, TwoInputs: true},
	{ID: "undark", Command: `ffmpeg -i %1 -vf "curves=all='0/0 0.1/0.9 1/1'" %1_undark.mp4`},
	{ID: "vavies", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(gt(sin(0.1*X+0.1*Y),0),A,B)'" output_waves_pattern.mp4`, TwoInputs: true},
	{ID: "vertical_sep_stripes", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(X/64)\,2)\,0)\,A,B)'" %1_verstr.mp4`, TwoInputs: true},
	{ID: "vertical_text_tora", Command: `ffmpeg -i %1 -filter_complex "[0:v]transpose=1[anticlockwiserotated];[anticlockwiserotated]drawtext=fontfile=Breezesans:text='Parachute Skirt':x=(w-tw)/2: y=h-2*th: fontsize=48: fontcolor=white:[textapplied];[textapplied]transpose=2" %1_f.mp4`},
	{ID: "vflip", Command: `ffmpeg -i %1 -vf "vflip" %1_vflip.mp4`},
	{ID: "vig", Command: `ffmpeg -i %1 -vf "vignette=PI/4:0.5,format=yuv420p" %1_vig.mp4`},
	{ID: "vignette", Command: `ffmpeg -i %1 -vf "vignette='PI/4'" -c:a copy %1_vignette.mp4`},
	{ID: "vstack", Command: `ffmpeg -i %1 -i %2 -filter_complex vstack=inputs=2 hstack-output.mp4`, TwoInputs: true},
	{ID: "warhole", Command: `ffmpeg -i %1 -filter_complex "[0]split=4[v1][v2][v3][v4];[v1]colorchannelmixer=rr=1.5:gg=0:bb=0[v1];[v2]colorchannelmixer=rr=0:gg=1.5:bb=0[v2];[v3]colorchannelmixer=rr=0:gg=0:bb=1.5[v3];[v4]colorchannelmixer=rr=1.5:gg=1.5:bb=0[v4];[v1][v2][v3][v4]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[out]" -map "[out]" %1_warhole.mp4`},
	{ID: "warmtone", Command: `ffmpeg -i %1 -vf colorchannelmixer=1:0.2:0:0:0.8:0:0:0:1 -c:a copy %1_coldwarm.mp4`},
	{ID: "wastepatt", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor(sqrt(pow(X-W/2\,2)+pow(Y-H/2\,2))/64)+floor(sin(T*0.1*X)*10)\,2)\,0)\,A,B)'" output_oscillating_circular_pattern.mp4`, TwoInputs: true},
	{ID: "watermark", Command: `ffmpeg -i %1 -i watermark.png -filter_complex "[0:v][1:v]overlay=main_w-overlay_w-10:main_h-overlay_h-10:enable='between(t,10,20)'" -c:v libx264 -crf 18 -preset fast output.mp4`, TwoInputs: true},
	{ID: "webm_segcut", Command: `ffmpeg -i %1 -c copy -map 0 -segment_time 10 -f segment output%%03d.webm`},
	{ID: "white_edge_else_black", Command: `ffmpeg -i input.mp4 -vf "edgedetect" output_edge.mp4`},
	{ID: "xray", Command: `ffmpeg -i %1 -vf "curves=negative,eq=contrast=3:brightness=-0.1,gblur=sigma=1.5" %1_xray.mp4`},
	{ID: "yeloo", Command: `ffmpeg -i %1 -filter_complex "[0]split=2[v3][v4];[v3]colorchannelmixer=rr=0:gg=1.5:bb=0[v3];[v4]colorchannelmixer=rr=1.5:gg=1.5:bb=0[v4];[v3][v4]xstack=inputs=2:layout=0_0|w0_0[out]" -map "[out]" %1_yeloo.mp4`},
	{ID: "yelosobel", Command: `ffmpeg -i %1 -vf "split=2[in][tmp];[in]sobel[edged];[tmp]palettegen[palette];[edged][palette]paletteuse" %1_yelosobel.mp4`, NeedsReview: true},
	{ID: "yn", Command: `ffmpeg -i %1 -vf lutyuv='y=negval' -c:a copy %1_yn.mp4`, NeedsReview: true},
	{ID: "zigg", Command: `ffmpeg -i %1 -i %2 -filter_complex "blend=all_expr='if(eq(mod(floor((X+Y*sin(X/64))/32)\,2)\,0)\,A,B)'" output_zigzag_pattern.mp4`, NeedsReview: true},
	{ID: "zoompan", Command: `ffmpeg -i %1 -vf "zoompan=z='1+0.0005*in':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1,format=yuv420p" -c:v libx264 -crf 18 -preset veryfast %1_zoompan.mp4`, NeedsReview: true},
}

// AllFilters preserves the original map[string][]string shape while skipping
// incomplete entries marked NeedsReview and deduplicating identical commands.
var AllFilters = buildFilterMap(AllFilterPresets)

func buildFilterMap(presets []FilterPreset) map[string][]string {
	out := make(map[string][]string)
	seen := make(map[string]map[string]struct{})

	for _, p := range presets {
		if p.NeedsReview || strings.TrimSpace(p.Command) == "" {
			continue
		}
		if seen[p.ID] == nil {
			seen[p.ID] = make(map[string]struct{})
		}
		if _, exists := seen[p.ID][p.Command]; exists {
			continue
		}
		seen[p.ID][p.Command] = struct{}{}
		out[p.ID] = append(out[p.ID], p.Command)
	}
	return out
}

var vfFlagPattern = regexp.MustCompile(`(?:-vf|-filter:v|-filter_complex)\s+(?:"([^"]*)"|'([^']*)'|([^\s]+))`)

type FrontendFilter struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Filter string `json:"filter"`
}

func FrontendVideoFilters() []FrontendFilter {
	out := make([]FrontendFilter, 0)
	seen := make(map[string]struct{})

	for _, preset := range AllFilterPresets {
		if preset.NeedsReview || preset.TwoInputs || preset.TwoPass {
			continue
		}

		filter := extractVideoFilter(preset.Command)
		if filter == "" || strings.Contains(filter, "%INPUT%") || strings.Contains(filter, "%1") {
			continue
		}

		key := preset.ID + "\x00" + filter
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, FrontendFilter{
			ID:     preset.ID,
			Name:   FilterDisplayName(preset.ID),
			Filter: filter,
		})
	}
	return out
}

func extractVideoFilter(command string) string {
	match := vfFlagPattern.FindStringSubmatch(command)
	if len(match) == 0 {
		return ""
	}
	for i := 1; i < len(match); i++ {
		if strings.TrimSpace(match[i]) != "" {
			return strings.TrimSpace(match[i])
		}
	}
	return ""
}

func FilterDisplayName(id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return "Filter"
	}
	words := strings.Fields(strings.NewReplacer("_", " ", "-", " ").Replace(id))
	for i, word := range words {
		if word == "" {
			continue
		}
		if len(word) == 1 {
			words[i] = strings.ToUpper(word)
			continue
		}
		words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
	}
	return strings.Join(words, " ")
}
