from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    list_display = ["username", "email", "first_name", "last_name", "profil", "niveau", "is_staff"]
    list_filter = ["profil", "niveau", "is_staff"]
    fieldsets = UserAdmin.fieldsets + (("INSTA-FORUM", {"fields": ["profil", "niveau"]}),)
