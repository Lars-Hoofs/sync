import { PrismaClient, Groep, GroepLidmaatschap, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { ServiceResult, CustomError } from '../types/common';

export interface GroepCreateData {
  naam: string;
  beschrijving?: string;
  organisatieId: string;
  rechten?: string[];
}

export interface GroepUpdateData {
  naam?: string;
  beschrijving?: string;
  rechten?: string[];
  isActief?: boolean;
}

export interface GroepWithMembers extends Groep {
  leden: Array<{
    id: string;
    user: {
      id: string;
      naam: string;
      email: string;
    };
    rol: string;
    toegevoegdOp: Date;
  }>;
  _count?: {
    leden: number;
  };
}

export interface GroepMemberData {
  userId: string;
  rol: string;
}

class GroepService {
  constructor(private prisma: PrismaClient) {}

  async createGroep(data: GroepCreateData, userId: string): Promise<ServiceResult<Groep>> {
    try {
      // Verificeer toegang tot organisatie
      const membership = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId: data.organisatieId,
          userId: userId,
          rol: {
            in: ['EIGENAAR', 'BEHEERDER']
          }
        }
      });

      if (!membership) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om groep te maken', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      // Controleer of groepnaam uniek is binnen organisatie
      const existingGroup = await this.prisma.groep.findFirst({
        where: {
          naam: data.naam,
          organisatieId: data.organisatieId
        }
      });

      if (existingGroup) {
        return {
          success: false,
          error: new CustomError('Groepnaam bestaat al binnen deze organisatie', 'GROUP_NAME_EXISTS', 400, 'GroepService')
        };
      }

      const groep = await this.prisma.groep.create({
        data: {
          naam: data.naam,
          beschrijving: data.beschrijving,
          organisatieId: data.organisatieId,
          rechten: data.rechten || [],
          isActief: true,
          aangemaakt: new Date(),
          bijgewerkt: new Date()
        }
      });

      logger.info(`Groep aangemaakt: ${groep.id} voor organisatie ${data.organisatieId} door ${userId}`);

      return {
        success: true,
        data: groep
      };
    } catch (error) {
      logger.error('Error creating group:', error);
      return {
        success: false,
        error: new CustomError('Failed to create group', 'GROUP_CREATE_ERROR', 500, 'GroepService')
      };
    }
  }

  async getGroepById(id: string, userId: string): Promise<ServiceResult<GroepWithMembers>> {
    try {
      const groep = await this.prisma.groep.findUnique({
        where: { id },
        include: {
          leden: {
            include: {
              user: {
                select: {
                  id: true,
                  naam: true,
                  email: true
                }
              }
            },
            orderBy: {
              toegevoegdOp: 'asc'
            }
          },
          organisatie: {
            select: {
              id: true,
              naam: true
            }
          },
          _count: {
            select: {
              leden: true
            }
          }
        }
      });

      if (!groep) {
        return {
          success: false,
          error: new CustomError('Groep niet gevonden', 'GROUP_NOT_FOUND', 404, 'GroepService')
        };
      }

      // Controleer toegang
      const hasAccess = await this.hasAccessToGroup(groep.organisatieId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om groep te bekijken', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      return {
        success: true,
        data: groep
      };
    } catch (error) {
      logger.error('Error getting group:', error);
      return {
        success: false,
        error: new CustomError('Failed to get group', 'GROUP_GET_ERROR', 500, 'GroepService')
      };
    }
  }

  async getGroepenByOrganization(organizationId: string, userId: string): Promise<ServiceResult<GroepWithMembers[]>> {
    try {
      const hasAccess = await this.hasAccessToGroup(organizationId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      const groepen = await this.prisma.groep.findMany({
        where: {
          organisatieId: organizationId,
          isActief: true
        },
        include: {
          leden: {
            include: {
              user: {
                select: {
                  id: true,
                  naam: true,
                  email: true
                }
              }
            },
            orderBy: {
              toegevoegdOp: 'asc'
            }
          },
          _count: {
            select: {
              leden: true
            }
          }
        },
        orderBy: {
          naam: 'asc'
        }
      });

      return {
        success: true,
        data: groepen
      };
    } catch (error) {
      logger.error('Error getting groups by organization:', error);
      return {
        success: false,
        error: new CustomError('Failed to get groups', 'GROUP_GET_ORGANIZATION_ERROR', 500, 'GroepService')
      };
    }
  }

  async updateGroep(id: string, data: GroepUpdateData, userId: string): Promise<ServiceResult<Groep>> {
    try {
      const groep = await this.prisma.groep.findUnique({
        where: { id },
        select: { organisatieId: true, naam: true }
      });

      if (!groep) {
        return {
          success: false,
          error: new CustomError('Groep niet gevonden', 'GROUP_NOT_FOUND', 404, 'GroepService')
        };
      }

      const hasAccess = await this.hasAccessToGroup(groep.organisatieId, userId, ['EIGENAAR', 'BEHEERDER']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om groep te wijzigen', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      // Controleer unieke naam binnen organisatie (als naam wordt gewijzigd)
      if (data.naam && data.naam !== groep.naam) {
        const existingGroup = await this.prisma.groep.findFirst({
          where: {
            naam: data.naam,
            organisatieId: groep.organisatieId,
            id: {
              not: id
            }
          }
        });

        if (existingGroup) {
          return {
            success: false,
            error: new CustomError('Groepnaam bestaat al binnen deze organisatie', 'GROUP_NAME_EXISTS', 400, 'GroepService')
          };
        }
      }

      const updatedGroep = await this.prisma.groep.update({
        where: { id },
        data: {
          ...data,
          bijgewerkt: new Date()
        }
      });

      return {
        success: true,
        data: updatedGroep
      };
    } catch (error) {
      logger.error('Error updating group:', error);
      return {
        success: false,
        error: new CustomError('Failed to update group', 'GROUP_UPDATE_ERROR', 500, 'GroepService')
      };
    }
  }

  async deleteGroep(id: string, userId: string): Promise<ServiceResult<boolean>> {
    try {
      const groep = await this.prisma.groep.findUnique({
        where: { id },
        select: { organisatieId: true }
      });

      if (!groep) {
        return {
          success: false,
          error: new CustomError('Groep niet gevonden', 'GROUP_NOT_FOUND', 404, 'GroepService')
        };
      }

      const hasAccess = await this.hasAccessToGroup(groep.organisatieId, userId, ['EIGENAAR', 'BEHEERDER']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om groep te verwijderen', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      // Verwijder alle lidmaatschappen eerst
      await this.prisma.$transaction([
        this.prisma.groepLidmaatschap.deleteMany({
          where: {
            groepId: id
          }
        }),
        this.prisma.groep.delete({
          where: { id }
        })
      ]);

      logger.info(`Groep verwijderd: ${id} door ${userId}`);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      logger.error('Error deleting group:', error);
      return {
        success: false,
        error: new CustomError('Failed to delete group', 'GROUP_DELETE_ERROR', 500, 'GroepService')
      };
    }
  }

  async addMemberToGroup(groupId: string, memberData: GroepMemberData, userId: string): Promise<ServiceResult<GroepLidmaatschap>> {
    try {
      // Controleer of groep bestaat en toegang
      const groep = await this.prisma.groep.findUnique({
        where: { id: groupId },
        select: { organisatieId: true }
      });

      if (!groep) {
        return {
          success: false,
          error: new CustomError('Groep niet gevonden', 'GROUP_NOT_FOUND', 404, 'GroepService')
        };
      }

      const hasAccess = await this.hasAccessToGroup(groep.organisatieId, userId, ['EIGENAAR', 'BEHEERDER']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om leden toe te voegen', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      // Controleer of gebruiker bestaat en lid is van organisatie
      const targetUserMembership = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          userId: memberData.userId,
          organisatieId: groep.organisatieId
        }
      });

      if (!targetUserMembership) {
        return {
          success: false,
          error: new CustomError('Gebruiker is geen lid van deze organisatie', 'USER_NOT_IN_ORGANIZATION', 400, 'GroepService')
        };
      }

      // Controleer of gebruiker al lid is van groep
      const existingMembership = await this.prisma.groepLidmaatschap.findFirst({
        where: {
          groepId: groupId,
          userId: memberData.userId
        }
      });

      if (existingMembership) {
        return {
          success: false,
          error: new CustomError('Gebruiker is al lid van deze groep', 'USER_ALREADY_IN_GROUP', 400, 'GroepService')
        };
      }

      const lidmaatschap = await this.prisma.groepLidmaatschap.create({
        data: {
          groepId: groupId,
          userId: memberData.userId,
          rol: memberData.rol,
          toegevoegdOp: new Date(),
          toegevoegdDoor: userId
        }
      });

      logger.info(`Gebruiker ${memberData.userId} toegevoegd aan groep ${groupId} door ${userId}`);

      return {
        success: true,
        data: lidmaatschap
      };
    } catch (error) {
      logger.error('Error adding member to group:', error);
      return {
        success: false,
        error: new CustomError('Failed to add member to group', 'GROUP_ADD_MEMBER_ERROR', 500, 'GroepService')
      };
    }
  }

  async removeMemberFromGroup(groupId: string, memberId: string, userId: string): Promise<ServiceResult<boolean>> {
    try {
      const groep = await this.prisma.groep.findUnique({
        where: { id: groupId },
        select: { organisatieId: true }
      });

      if (!groep) {
        return {
          success: false,
          error: new CustomError('Groep niet gevonden', 'GROUP_NOT_FOUND', 404, 'GroepService')
        };
      }

      const hasAccess = await this.hasAccessToGroup(groep.organisatieId, userId, ['EIGENAAR', 'BEHEERDER']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om leden te verwijderen', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      const membership = await this.prisma.groepLidmaatschap.findFirst({
        where: {
          groepId: groupId,
          userId: memberId
        }
      });

      if (!membership) {
        return {
          success: false,
          error: new CustomError('Gebruiker is geen lid van deze groep', 'USER_NOT_IN_GROUP', 404, 'GroepService')
        };
      }

      await this.prisma.groepLidmaatschap.delete({
        where: {
          id: membership.id
        }
      });

      logger.info(`Gebruiker ${memberId} verwijderd uit groep ${groupId} door ${userId}`);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      logger.error('Error removing member from group:', error);
      return {
        success: false,
        error: new CustomError('Failed to remove member from group', 'GROUP_REMOVE_MEMBER_ERROR', 500, 'GroepService')
      };
    }
  }

  async updateMemberRole(groupId: string, memberId: string, newRole: string, userId: string): Promise<ServiceResult<GroepLidmaatschap>> {
    try {
      const groep = await this.prisma.groep.findUnique({
        where: { id: groupId },
        select: { organisatieId: true }
      });

      if (!groep) {
        return {
          success: false,
          error: new CustomError('Groep niet gevonden', 'GROUP_NOT_FOUND', 404, 'GroepService')
        };
      }

      const hasAccess = await this.hasAccessToGroup(groep.organisatieId, userId, ['EIGENAAR', 'BEHEERDER']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om rollen te wijzigen', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      const membership = await this.prisma.groepLidmaatschap.findFirst({
        where: {
          groepId: groupId,
          userId: memberId
        }
      });

      if (!membership) {
        return {
          success: false,
          error: new CustomError('Gebruiker is geen lid van deze groep', 'USER_NOT_IN_GROUP', 404, 'GroepService')
        };
      }

      const updatedMembership = await this.prisma.groepLidmaatschap.update({
        where: {
          id: membership.id
        },
        data: {
          rol: newRole
        }
      });

      logger.info(`Rol van gebruiker ${memberId} in groep ${groupId} gewijzigd naar ${newRole} door ${userId}`);

      return {
        success: true,
        data: updatedMembership
      };
    } catch (error) {
      logger.error('Error updating member role:', error);
      return {
        success: false,
        error: new CustomError('Failed to update member role', 'GROUP_UPDATE_MEMBER_ROLE_ERROR', 500, 'GroepService')
      };
    }
  }

  async getUserGroups(userId: string, organizationId?: string): Promise<ServiceResult<GroepWithMembers[]>> {
    try {
      const whereClause: Prisma.GroepLidmaatschapWhereInput = {
        userId: userId
      };

      if (organizationId) {
        whereClause.groep = {
          organisatieId: organizationId
        };
      }

      const memberships = await this.prisma.groepLidmaatschap.findMany({
        where: whereClause,
        include: {
          groep: {
            include: {
              leden: {
                include: {
                  user: {
                    select: {
                      id: true,
                      naam: true,
                      email: true
                    }
                  }
                }
              },
              _count: {
                select: {
                  leden: true
                }
              }
            }
          }
        }
      });

      const groepen = memberships.map(membership => membership.groep);

      return {
        success: true,
        data: groepen
      };
    } catch (error) {
      logger.error('Error getting user groups:', error);
      return {
        success: false,
        error: new CustomError('Failed to get user groups', 'GROUP_GET_USER_GROUPS_ERROR', 500, 'GroepService')
      };
    }
  }

  async getGroupPermissions(groupId: string): Promise<ServiceResult<string[]>> {
    try {
      const groep = await this.prisma.groep.findUnique({
        where: { id: groupId },
        select: { rechten: true }
      });

      if (!groep) {
        return {
          success: false,
          error: new CustomError('Groep niet gevonden', 'GROUP_NOT_FOUND', 404, 'GroepService')
        };
      }

      return {
        success: true,
        data: groep.rechten
      };
    } catch (error) {
      logger.error('Error getting group permissions:', error);
      return {
        success: false,
        error: new CustomError('Failed to get group permissions', 'GROUP_GET_PERMISSIONS_ERROR', 500, 'GroepService')
      };
    }
  }

  async updateGroupPermissions(groupId: string, permissions: string[], userId: string): Promise<ServiceResult<Groep>> {
    try {
      const groep = await this.prisma.groep.findUnique({
        where: { id: groupId },
        select: { organisatieId: true }
      });

      if (!groep) {
        return {
          success: false,
          error: new CustomError('Groep niet gevonden', 'GROUP_NOT_FOUND', 404, 'GroepService')
        };
      }

      const hasAccess = await this.hasAccessToGroup(groep.organisatieId, userId, ['EIGENAAR', 'BEHEERDER']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om permissies te wijzigen', 'INSUFFICIENT_PERMISSIONS', 403, 'GroepService')
        };
      }

      const updatedGroep = await this.prisma.groep.update({
        where: { id: groupId },
        data: {
          rechten: permissions,
          bijgewerkt: new Date()
        }
      });

      logger.info(`Permissies van groep ${groupId} gewijzigd door ${userId}`);

      return {
        success: true,
        data: updatedGroep
      };
    } catch (error) {
      logger.error('Error updating group permissions:', error);
      return {
        success: false,
        error: new CustomError('Failed to update group permissions', 'GROUP_UPDATE_PERMISSIONS_ERROR', 500, 'GroepService')
      };
    }
  }

  // Helper methods

  private async hasAccessToGroup(organizationId: string, userId: string, requiredRoles?: string[]): Promise<boolean> {
    const roles = requiredRoles || ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER'];
    
    const membership = await this.prisma.organisatieLidmaatschap.findFirst({
      where: {
        organisatieId: organizationId,
        userId: userId,
        rol: {
          in: roles
        }
      }
    });

    return !!membership;
  }
}

export default GroepService;
