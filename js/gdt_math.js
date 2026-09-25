// js/gdt_math.js
// Shared GD&T calculations, so every tool applies the same rules.

export const EPS = 1e-9;

/**
 * Position of one feature of size (ASME Y14.5), with RFS / MMC / LMC bonus.
 *   featureType: 'hole' | 'pin'
 *   modifier:    'RFS' | 'MMC' | 'LMC'
 *   tolerance:   stated position tolerance (diameter)
 *   nominal, plusTol, minusTol: size limits
 *   actualSize:  measured size (actual mating size)
 *   dx, dy:      measured axis offset from true position
 */
export function evaluatePosition({ featureType, modifier, tolerance, nominal, plusTol, minusTol, actualSize, dx, dy }) {
    const isHole = featureType === 'hole';
    const lower = nominal - minusTol;
    const upper = nominal + plusTol;
    const mmc = isHole ? lower : upper;          // Most material: smallest hole, largest pin
    const lmc = isHole ? upper : lower;
    const sizeRange = upper - lower;
    const sizeOK = actualSize >= lower - EPS && actualSize <= upper + EPS;

    // Bonus = how far the actual size has departed from the modifier's condition
    let bonusRaw = 0;
    if (modifier === 'MMC') bonusRaw = isHole ? actualSize - mmc : mmc - actualSize;
    if (modifier === 'LMC') bonusRaw = isHole ? lmc - actualSize : actualSize - lmc;
    const bonus = Math.min(Math.max(bonusRaw, 0), sizeRange);
    const maxBonus = modifier === 'RFS' ? 0 : sizeRange;

    const allowed = tolerance + bonus;
    const radial = Math.hypot(dx, dy);
    const position = 2 * radial;
    const posOK = position <= allowed + EPS;

    // Virtual condition: the constant worst-case boundary (not defined for RFS)
    let vc = null;
    if (modifier === 'MMC') vc = isHole ? mmc - tolerance : mmc + tolerance;
    if (modifier === 'LMC') vc = isHole ? lmc + tolerance : lmc - tolerance;

    return {
        isHole, lower, upper, mmc, lmc, sizeRange, sizeOK,
        bonus, maxBonus, allowed, radial, position, posOK, vc,
        pass: sizeOK && posOK
    };
}
