import { IncidentDto } from "../incident/dto/incident.dto";
import { IncidentPriority } from "../incident/entities/incident.entity";

/**
 * Reusable helper logic for incident priority auto-assignment.
 * Strictly follows business rules for Grade A.1, CEO/Chairman, and Content Matching.
 */
export class PriorityHelper {
  
  /**
   * Safely normalizes text for comparison (lowercase, trimmed, null-safe).
   */
  static normalizeText(value: string | null | undefined): string {
    if (!value) return '';
    return value.toString().toLowerCase().trim();
  }

  /**
   * Rule 1: Grade A.1 => Critical
   */
  static isGradeCritical(gradeName: string | null | undefined): boolean {
    const normalized = this.normalizeText(gradeName);
    return normalized === 'a.1' || normalized === 'a1';
  }

  /**
   * Rule 2: Critical Designations => Critical
   * Role matching uses word boundaries to handle formats like "CEO / Platforms"
   */
  static isCriticalDesignation(designation: string | null | undefined): boolean {
    const normalized = this.normalizeText(designation);
    const criticalRoles = [
      /\bchairman\b/, 
      /\bceo\b/, 
      /\bchief executive officer\b/, 
      /\bchief officer\b/, 
      /\bdeputy chief officer\b/
    ];
    return criticalRoles.some(regex => regex.test(normalized));
  }

  /**
   * Rule 4: Management Designations => High
   * Matches "GM", "DGM", etc. robustly using word boundaries.
   */
  static isHighDesignation(designation: string | null | undefined): boolean {
    const normalized = this.normalizeText(designation);
    const highRoles = [
      /\bgm\b/, 
      /\bgeneral manager\b/, 
      /\bdgm\b/, 
      /\bdeputy general manager\b/
    ];
    return highRoles.some(regex => regex.test(normalized));
  }

  /**
   * Rule 3: Content-based (Cashiering / Network) => Critical
   */
  static isCriticalIncidentType(
    category: string | null | undefined, 
    title: string | null | undefined, 
    description: string | null | undefined
  ): boolean {
    const combinedText = this.normalizeText(`${category} ${title} ${description}`);
    const criticalKeywords = [
      'cashiering', 'cash point', 'cashier', 
      'network', 'site down', 'switch failure', 'network issue', 'connectivity'
    ];
    return criticalKeywords.some(kw => combinedText.includes(kw));
  }

  /**
   * Main logic for auto-priority determination.
   * Priority Order: Grade A.1 -> Critical Roles -> Content (Network/Cashiering) -> High Roles -> Medium
   */
  static getAutoPriority(
    employee: { designation?: string; gradeName?: string },
    incident: Partial<IncidentDto>
  ): IncidentPriority {
    
    // 1. Rule 1: Grade A.1 => Critical
    if (this.isGradeCritical(employee.gradeName)) {
      return IncidentPriority.CRITICAL;
    }

    // 2. Rule 2: Critical Designations => Critical
    if (this.isCriticalDesignation(employee.designation)) {
      return IncidentPriority.CRITICAL;
    }

    // 3. Rule 3: Specific Incident Types => Critical
    if (this.isCriticalIncidentType(incident.category, incident.description, incident.description)) {
      return IncidentPriority.CRITICAL;
    }

    // 4. Rule 4: High Roles (GM/DGM) => High
    if (this.isHighDesignation(employee.designation)) {
      return IncidentPriority.HIGH;
    }

    // 5. Rule 5: Default => Medium
    return IncidentPriority.MEDIUM;
  }
}
