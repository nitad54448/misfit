# Misfit Le Bail Fit - Technical Guide

This document provides a technical reference for the "Misfit Le Bail Fit" web application, a tool for the analysis of powder X-ray diffraction (PXRD) data.

## How to Start

To start this program, you can go [here](https://nitad54448.github.io/misfit/misfit.html).

## Table of Contents

* [Introduction & Core Methodology](#introduction--core-methodology)
* [Quick Start Guide](#quick-start-guide)
* [The User Interface](#the-user-interface)
    * [File Loading & Main Controls](#file-loading--main-controls)
    * [Tab: Sample](#tab-sample)
    * [Tab: Background](#tab-background)
    * [Tab: Profile](#tab-profile)
    * [Refinement Panel](#refinement-panel)
    * [Interactive Chart](#interactive-chart)
* [Core Algorithms Explained](#core-algorithms-explained)
    * [Le Bail Method](#le-bail-method)
    * [Background Model: Rolling Ball](#background-model-rolling-ball)
    * [Profile Function #4 (GSAS)](#profile-function-4-gsas)
    * [Parameter Constraints](#parameter-constraints)
* [Minimization Algorithms](#minimization-algorithms)
    * [Levenberg-Marquardt (LM)](#levenberg-marquardt-lm)
    * [Simulated Annealing (SA)](#simulated-annealing-sa)
* [Recommended Refinement Strategy](#recommended-refinement-strategy)
* [Interpretation of Results](#interpretation-of-results)
* [About This Tool](#about-this-tool)

---

<section id="introduction--core-methodology">

## Introduction & Core Methodology

This application is a tool for performing a Le Bail (whole-pattern) fit on powder diffraction data containing **two separate phases**. Its primary purpose is to refine the lattice parameters for both phases simultaneously.

The program's key feature is the ability to **constrain parameters** between the two phases. For example, you can force `Phase 2` to have the same `a` and `c` lattice parameters as `Phase 1`, while allowing its `b` parameter to refine independently. This makes the tool ideal for analyzing **misfit compounds**, composites, or samples with closely related phases.

The core methodology consists of:
1.  **Le Bail Intensity Extraction:** An iterative process where the observed intensities are partitioned among all theoretical reflections. This allows for refinement without a full structural model (atomic coordinates).
2.  **Two-Phase Model:** The calculated pattern is the sum of two independent crystallographic phases (plus background).
3.  **Fixed Background:** The background is modeled *first* using a **rolling ball algorithm**. This calculated background is then held constant (fixed) during the main parameter refinement.
4.  **Profile Modeling:** Peak shapes are modeled using the versatile **GSAS Profile Function #4**, a simple pseudo-Voigt function.

</section>

---

<section id="quick-start-guide">

## Quick Start Guide

1.  **Load Data:** Click `Select Data File` to load your PXRD data. The program supports a wide range of formats (e.g., `.xrdml`, `.brml`, `.ras`, `.uxd`, `.xy`, `.esd`).
2.  **Set Background:** Go to the **Background** tab. Adjust the `Ball Radius` and `Smoothing` sliders until the green "Background" line on the chart accurately models the experimental background.
3.  **Set Phase 1:** Go to the **Sample** tab.
    * Select the correct `System` (e.g., "Orthorhombic (C)").
    * Enter your best initial guess for the **lattice parameters** of Phase 1.
4.  **Set Phase 2:**
    * Select the `System` for Phase 2.
    * Enter the initial lattice parameters for Phase 2.
5.  **Set Constraints:** Under `Lattice Constraints`, check the boxes for any parameters that should be **identical** for both phases (e.g., check `a` and `c` if they are shared).
6.  **Check Parameters:**
    * Verify the `Radiation (Å)` (wavelength) is correct.
    * On the **Profile** tab, check that the initial broadening parameters (`GW`, `LX`, etc.) are reasonable.
7.  **Set Range & Algorithm:**
    * In the bottom `Refinement` panel, use the `2θ Min/Max` sliders to select the fitting range.
    * Select the `Simulated Annealing` method for the first refinement, as it's better at finding a good solution from a poor starting guess.
8.  **Run Fit:** Click `Run Refinement`.
9.  **Analyze & Refine:**
    * Check the visual fit (blue "Calculated" line vs. gray "Experimental" line) and the $R_{wp}$ / $\chi^2$ values.
    * For a final, high-precision fit, select the `Levenberg-Marquardt` method and click `Run Refinement` again.
10. **Export:** Click `Save Report` (for a detailed `.txt` file with ESDs) or `Generate PDF` (for a summary).

</section>

---

<section id="the-user-interface">

## The User Interface

### File Loading & Main Controls

* **Select Data File:** Loads the experimental data.
* **Help Tooltip (?):** Provides a brief overview of the program and chart controls.

### Tab: Sample

This tab controls all crystallographic and instrumental parameters.

* **Phase 1 Parameters:**
    * `System`: Select the crystal system and lattice centering for the first phase.
    * `Lattice Parameters`: Input fields for $a, b, c, \alpha, \beta, \gamma$. The available fields change based on the selected system. Check the box next to a parameter to refine it.
* **Phase 2 Parameters:**
    * Identical to Phase 1, but for the second phase.
* **Lattice Constraints:**
    * Checkboxes for $a, b, c, \alpha, \beta, \gamma$. Checking a box (e.g., `a`) will **force the 'a' parameter of Phase 2 to be equal to the 'a' parameter of Phase 1**. The input field for Phase 2's 'a' will become disabled.
* **Instrumental Parameters:**
    * `Radiation (Å)`: The X-ray wavelength.
    * `Zero (°)`: A refinable zero-point shift ($2\theta$) correction for the entire pattern.

### Tab: Background

This tab controls the pre-fit background subtraction.

* **Background (Rolling Ball):**
    * `Ball Radius (pts)`: Controls the "width" of the background algorithm. A larger radius will follow broader features.
    * `Smoothing (pts)`: Applies a smoothing filter to the data *before* the background algorithm runs, helping to prevent noise from being included in the background.

### Tab: Profile

This tab controls the parameters for the **GSAS Profile Function #4**, which is shared by both phases.

* **Gaussian Broadening:**
    * `GU`, `GV`, `GW`: Parameters controlling the Gaussian FWHM.
    * `GP`: An additional Gaussian term for particle size effects.
* **Lorentzian Broadening:**
    * `LX`: Parameter controlling the Lorentzian FWHM (size broadening).
* **Peak Shape & Position:**
    * `eta (Mixing)`: The pseudo-Voigt mixing parameter ($\eta=0$ for pure Gaussian, $\eta=1$ for pure Lorentzian).
    * `shft (Displ.)`: Corrects for peak shifts from sample displacement.
    * `trns (Transp.)`: Corrects for peak shifts from sample transparency.

### Refinement Panel

Located at the bottom of the control panel, this area launches the fit and displays results.

* **Method:** Select the minimization algorithm (`Levenberg-Marquardt` or `Simulated Annealing`).
* **2θ Min / Max:** Sliders to define the angular range for refinement.
* **Max Iterations:** Sets the maximum number of cycles for the selected algorithm.
* **Run Refinement:** Starts or stops the fitting process.
* **Results:** Displays the final figures of merit: $R_p$ (R-pattern), $R_{wp}$ (weighted R-pattern), and $\chi^2$ (Chi-squared or Goodness of Fit).
* **Export Buttons:** `Save Report` (generates a detailed `.txt` file) and `Generate PDF` (generates a PDF summary).

### Interactive Chart

* **Pan:** Click and drag on the chart to move the view.
* **Zoom:** Use the mouse wheel. Zooming over the **plot area** zooms both axes. Zooming over the **X-axis** zooms $2\theta$ only. Zooming over the **Y-axis** zooms intensity only.
* **Reset View:** A **right-click** on the chart resets the zoom and pan.
* **Legend:** Click on labels ('Experimental', 'Calculated', etc.) to toggle their visibility.

</section>

---

<section id="core-algorithms-explained">

## Core Algorithms Explained

### Le Bail Method

The Le Bail method is an iterative process for fitting a pattern without a full structural model. It works as follows:

1.  **Generate HKLs:** The program calculates the $2\theta$ positions of all theoretical reflections for both phases based on their current lattice parameters.
2.  **Intensity Extraction:** The program steps through the *observed* (experimental) data. At each $2\theta$ point, it distributes the observed intensity (minus background) among all nearby calculated peaks. A peak gets a "share" of the intensity proportional to its profile shape at that point.
3.  **Sum Intensities:** The partitioned "shares" for each peak are summed up over its full width, yielding a new set of "observed" integrated intensities ($I_{hkl}$).
4.  **Least-Squares Refinement:** These new intensities are held constant. A non-linear least-squares algorithm (LM or SA) refines the **lattice, profile, and instrumental parameters** to get the best possible match between the calculated pattern and the observed data.
5.  **Iterate:** The process repeats from Step 1 using the newly refined parameters. The cycle continues until the parameters and $R$-factors converge.

### Background Model: Rolling Ball

This program uses a **fixed background** model. You must set the background *before* running the refinement.

The "rolling ball" (or "rolling circle") algorithm works by notionally rolling a ball of a specified `Radius` "under" the diffraction pattern. The path traced by the top of this ball is considered the background.

* A **small radius** will dip into the valleys between sharp peaks, potentially over-estimating the background.
* A **large radius** will skim across the top of broader features, better suited for patterns with a high or amorphous background.

This calculated background is subtracted from the experimental data to create a "net" pattern, which is then used for the Le Bail intensity extraction.

### Profile Function #4 (GSAS)

This function models the peak shape as a **pseudo-Voigt**, a simple mix of Gaussian and Lorentzian functions. The Full Width at Half Maximum (FWHM) of each component ($\Gamma_G$ and $\Gamma_L$) depends on $2\theta$.

$$\Gamma_G^2 = GU' \tan^2\theta + GV' \tan\theta + GW' + GP' / \cos^2\theta$$
$$\Gamma_L = LX' / \cos\theta$$

> **Parameter Scaling:**
> Note that the refined parameters (`GU`, `GV`, `GW`, `GP`, `LX`) are **scaled** for user convenience, a convention used in GSAS.
>
> * $GU' = GU / 100$
> * $GV' = GV / 100$
> * $GW' = GW / 100$
> * $GP' = GP / 100$
> * $LX' = LX / 100$

> **Specimen Displacement (`shft`):**
> The `shft` parameter is a **dimensionless, scaled coefficient**, not a direct physical length.
> * The physical shift in degrees is: $\Delta(2\theta)_{\text{deg}} = -(\text{shft} / 1000) \times \cos(\theta) \times (180 / \pi)$
> * To find the physical displacement $s$ (in mm) from the refined parameter, use: $s = R \times (\text{shft} / 2000)$, where $R$ is the goniometer radius in mm.

### Parameter Constraints

This is the central feature of the program. When a constraint (e.g., `a`) is checked, the refinement algorithm treats `a1` (from Phase 1) and `a2` (from Phase 2) as a **single variable**. Any change applied to `a1` during refinement is also applied to `a2`, forcing them to refine to the same value.

</section>

---

<section id="minimization-algorithms">

## Minimization Algorithms

The goal of refinement is to find the set of parameters that minimizes the difference between the observed and calculated patterns.

### Levenberg-Marquardt (LM)

* **Type:** Local, gradient-based minimizer.
* **Pros:** Very fast and efficient when the starting guess is good. It is the **only method** in this program that can calculate valid **Estimated Standard Deviations (ESDs)**, or error bars, for the refined parameters.
* **Cons:** Can easily get "stuck" in a local minimum. If your starting parameters are poor, it will likely fail to find the correct solution.

### Simulated Annealing (SA)

* **Type:** Global, stochastic minimizer.
* **Pros:** Excellent for exploring the entire parameter space and avoiding local minima. It's the **best choice for the initial refinement** when you are unsure of the starting parameters.
* **Cons:** Much slower than LM. It does not calculate parameter ESDs.

</section>

---

<section id="recommended-refinement-strategy">

## Recommended Refinement Strategy

A hierarchical strategy is essential for a stable refinement, especially with two phases.

1.  **Phase 1: Setup & Background:**
    * Load data.
    * Go to the **Background** tab and find the best possible background fit using the sliders. This step is critical as the background is *not* refined later.
2.  **Phase 2: Initial Model:**
    * Go to the **Sample** tab. Enter your best guesses for the lattice parameters of **both phases**.
    * Set your desired **Constraints**.
    * Check all other parameters (Profile, Instrumental) for sensible starting values.
3.  **Phase 3: Global Search (SA):**
    * Select the **Simulated Annealing (SA)** algorithm.
    * Select the parameters you want to refine (e.g., lattice parameters and key profile parameters like `GW` and `LX`).
    * Click `Run Refinement`. Let it run for a sufficient number of iterations (e.g., 50-100).
    * This should get your parameters *close* to the correct (global minimum) solution, even if the fit isn't perfect.
4.  **Phase 4: Local Precision (LM):**
    * Once SA is complete, select the **Levenberg-Marquardt (LM)** algorithm.
    * Refine all parameters you are interested in.
    * Click `Run Refinement`. The LM algorithm will quickly "snap" the parameters to the nearest, high-precision minimum.
5.  **Phase 5: Final Review:**
    * Analyze the final $R$-factors and, most importantly, the **Difference Plot** (the red line). A good fit will have a flat, noisy difference line with no "M-shaped" or unmodeled peaks.
    * Click `Save Report` to get the final parameter values and their **ESDs** (from the LM fit).

</section>

---

<section id="interpretation-of-results">

## Interpretation of Results

### Figures of Merit

* **R-pattern ($R_p$):** The unweighted residual error.
    $$R_p = \frac{\sum |y_{i,obs} - y_{i,calc}|}{\sum y_{i,obs}} \times 100\%$$
* **Weighted R-pattern ($R_{wp}$):** The primary figure of merit, which accounts for counting statistics (points with higher intensity are given more "weight").
    $$R_{wp} = \left[ \frac{\sum w_i (y_{i,obs} - y_{i,calc})^2}{\sum w_i y_{i,obs}^2} \right]^{1/2} \times 100\%$$
* **Reduced Chi-squared ($\chi^2$, GOF):** The Goodness of Fit. For a statistically perfect fit, this value should be 1.0.
    $$\chi^2 = \frac{\sum w_i (y_{i,obs} - y_{i,calc})^2}{N - P}$$
    (where $N$ is the number of data points and $P$ is the number of refined parameters).

### Visual Inspection

Always trust your eyes over the $R$-factors. The **Difference Plot** (red line) is your best guide. A successful refinement should yield a difference plot that consists of random, uncorrelated noise centered on zero. Any systematic features (humps, M-shapes, un-indexed peaks) indicate a problem with your model (e.g., wrong profile shape, incorrect lattice parameters, or a missed phase).

### Data Export

* **Save Report:** Generates a comprehensive `.txt` file. This is the **most important** output, as it contains:
    * Final refined parameter values.
    * **Estimated Standard Deviations (ESDs)** for all refined parameters (if LM was used).
    * A list of all calculated reflections ($hkl$, $2\theta$, $d$-spacing).
    * A point-by-point list of observed, calculated, and difference intensities.
* **Generate PDF:** Creates a summary PDF document with a high-resolution plot and tables of the final parameters, suitable for reports.

</section>

---

<section id="about-this-tool">

## About This Tool

This toolkit was developed by NitaD, Univ Paris-Saclay (19 Sept 2025).

</section>
